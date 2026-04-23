<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreClientRequest;
use App\Http\Requests\UpdateClientRequest;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Client::query()->with('vendor')->orderBy('name');

        if ($request->query('vendor_id')) {
            $query->where('vendor_id', $request->query('vendor_id'));
        }

        if ($q = $request->query('q')) {
            $query->where(function ($w) use ($q) {
                $w->where('name', 'like', '%'.$q.'%')
                    ->orWhere('rif', 'like', '%'.$q.'%')
                    ->orWhere('city', 'like', '%'.$q.'%');
            });
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function store(StoreClientRequest $request): JsonResponse
    {
        $client = Client::query()->create($request->validated());

        return response()->json($client->load('vendor'), 201);
    }

    public function show(Client $client): JsonResponse
    {
        return response()->json($client->load('vendor'));
    }

    public function update(UpdateClientRequest $request, Client $client): JsonResponse
    {
        $client->update($request->validated());

        return response()->json($client->fresh()->load('vendor'));
    }
}
