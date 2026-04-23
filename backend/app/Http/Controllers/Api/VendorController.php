<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreVendorRequest;
use App\Http\Requests\UpdateVendorRequest;
use App\Models\Vendor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Vendor::query()->orderBy('name');

        if ($request->query('active') !== null) {
            $query->where('active', (bool) $request->query('active'));
        }

        if ($q = $request->query('q')) {
            $query->where('name', 'like', '%'.$q.'%');
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function store(StoreVendorRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['active'] = $data['active'] ?? true;

        $vendor = Vendor::query()->create($data);

        return response()->json($vendor, 201);
    }

    public function show(Vendor $vendor): JsonResponse
    {
        return response()->json($vendor);
    }

    public function update(UpdateVendorRequest $request, Vendor $vendor): JsonResponse
    {
        $vendor->update($request->validated());

        return response()->json($vendor->fresh());
    }
}

