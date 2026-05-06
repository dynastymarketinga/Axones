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
        // Más nuevos primero (UX catálogo).
        $query = Vendor::query()->orderByDesc('created_at');

        if (($active = $request->query('active')) !== null && $active !== '') {
            $query->where('active', filter_var($active, FILTER_VALIDATE_BOOLEAN));
        }

        if ($q = $request->query('q')) {
            $query->where(function ($w) use ($q) {
                $w->where('name', 'like', '%'.$q.'%')
                    ->orWhere('phone_primary', 'like', '%'.$q.'%')
                    ->orWhere('phone_secondary', 'like', '%'.$q.'%');
            });
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 200)));
    }

    public function store(StoreVendorRequest $request): JsonResponse
    {
        $payload = $request->validated();
        // Al crear un vendedor se asume activo (la desactivación se maneja en listado).
        $payload['active'] = true;

        // Compatibilidad: si algún cliente aún manda `phone`, lo mapeamos a principal.
        if (! array_key_exists('phone_primary', $payload)) {
            $phoneLegacy = $request->input('phone');
            if (is_string($phoneLegacy) && trim($phoneLegacy) !== '') {
                $payload['phone_primary'] = trim($phoneLegacy);
            }
        }

        $vendor = Vendor::query()->create($payload);

        return response()->json($vendor, 201);
    }

    public function show(Vendor $vendor): JsonResponse
    {
        return response()->json($vendor);
    }

    public function update(UpdateVendorRequest $request, Vendor $vendor): JsonResponse
    {
        $payload = $request->validated();

        // Compatibilidad: permitir `phone` como alias de principal.
        if (! array_key_exists('phone_primary', $payload)) {
            $phoneLegacy = $request->input('phone');
            if (is_string($phoneLegacy) && trim($phoneLegacy) !== '') {
                $payload['phone_primary'] = trim($phoneLegacy);
            }
        }

        $vendor->update($payload);

        return response()->json($vendor->fresh());
    }
}

