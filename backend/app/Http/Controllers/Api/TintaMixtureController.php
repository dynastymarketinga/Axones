<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTintaMixtureRequest;
use App\Models\TintaMixture;
use App\Services\TintaMixtureService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TintaMixtureController extends Controller
{
    public function __construct(
        private readonly TintaMixtureService $mixtures,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = TintaMixture::query()
            ->with(['outputMaterial', 'creator', 'materialRequest'])
            ->withCount('components')
            ->orderByDesc('created_at');

        $q = trim((string) $request->query('q', ''));
        if ($q !== '') {
            $escaped = addcslashes($q, '%_\\');
            $like = '%'.$escaped.'%';
            $query->where(function ($w) use ($like): void {
                $w->where('output_sku', 'like', $like)
                    ->orWhere('output_name', 'like', $like)
                    ->orWhereHas('outputMaterial', function ($m) use ($like): void {
                        $m->where('name', 'like', $like)->orWhere('sku', 'like', $like);
                    })->orWhereHas('creator', function ($u) use ($like): void {
                        $u->where('name', 'like', $like);
                    });
            });
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function store(StoreTintaMixtureRequest $request): JsonResponse
    {
        $mixture = $this->mixtures->create($request->validated(), $request->user());

        return response()->json($mixture, 201);
    }

    public function show(TintaMixture $tinta_mixture): JsonResponse
    {
        $tinta_mixture->load(['components.material', 'outputMaterial', 'creator']);

        return response()->json($tinta_mixture);
    }
}
