<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductBulkImportRequest;
use App\Http\Requests\StoreProductRequest;
use App\Http\Requests\UpdateProductRequest;
use App\Models\Product;
use App\Services\ProductBulkImportService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function __construct(
        private readonly ProductBulkImportService $bulkImport,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Product::query()->with('client')->orderBy('name');

        if ($request->query('client_id')) {
            $query->where('client_id', $request->query('client_id'));
        }

        if ($q = $request->query('q')) {
            $query->where(function ($w) use ($q) {
                $w->where('name', 'like', '%'.$q.'%')
                    ->orWhere('mps', 'like', '%'.$q.'%')
                    ->orWhere('cpe', 'like', '%'.$q.'%')
                    ->orWhere('barcode', 'like', '%'.$q.'%');
            });
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 200)));
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        $product = Product::query()->create($request->validated());

        return response()->json($product->load('client'), 201);
    }

    public function show(Product $product): JsonResponse
    {
        return response()->json($product->load('client'));
    }

    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        $product->update($request->validated());

        return response()->json($product->fresh()->load('client'));
    }

    public function bulkImport(ProductBulkImportRequest $request): JsonResponse
    {
        $this->assertCanBulkImportProducts($request);

        $validated = $request->validated();
        $dryRun = (bool) ($validated['dry_run'] ?? false);

        $result = $this->bulkImport->import(
            $validated['clients'] ?? [],
            $validated['products'],
            $dryRun,
            isset($validated['source_filename']) ? (string) $validated['source_filename'] : null,
        );

        return response()->json($result);
    }

    /**
     * @throws AuthorizationException
     */
    private function assertCanBulkImportProducts(Request $request): void
    {
        $role = mb_strtolower(trim((string) ($request->user()?->role ?? '')));
        $allowed = [
            'boss',
            'admin',
            'jefe_supremo',
            'superadmin',
            'jefe_operaciones',
            'inventory_chief',
            'jefe_inventario',
            'jefe_almacen',
            'inventory',
            'inventario',
        ];
        if (! in_array($role, $allowed, true)) {
            throw new AuthorizationException('No autorizado para importar especificaciones de producto.');
        }
    }
}
