<?php

namespace App\Http\Controllers\Api;

use App\Enums\ClientOrderStatus;
use App\Enums\WorkOrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreClientOrderRequest;
use App\Http\Requests\UpdateClientOrderRequest;
use App\Models\ClientOrder;
use App\Models\ClientOrderLine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClientOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $sortDirection = strtolower(trim((string) $request->query('sort', 'asc'))) === 'desc' ? 'desc' : 'asc';
        $query = ClientOrder::query()
            ->with(['client', 'firstLineWithProduct.product'])
            ->withCount('lines')
            ->withCount([
                'workOrders as active_work_orders_count' => function ($q) {
                    $q->where('status', '!=', WorkOrderStatus::Cancelled->value);
                },
            ])
            ->orderBy('created_at', $sortDirection)
            ->orderBy('id', $sortDirection);

        if ($request->query('client_id')) {
            $query->where('client_id', $request->query('client_id'));
        }

        if ($request->query('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($q = trim((string) $request->query('q', ''))) {
            $query->where(function ($inner) use ($q) {
                $inner->where('code', 'like', '%'.$q.'%')
                    ->orWhereHas('client', function ($clientQuery) use ($q) {
                        $clientQuery->where('name', 'like', '%'.$q.'%');
                    })
                    ->orWhereHas('firstLineWithProduct.product', function ($productQuery) use ($q) {
                        $productQuery->where('name', 'like', '%'.$q.'%');
                    });
            });

            // Prioriza coincidencia exacta al inicio, luego starts-with; mantiene orden base asc/desc.
            $query->orderByRaw(
                'CASE
                    WHEN code = ? THEN 0
                    WHEN code LIKE ? THEN 1
                    ELSE 2
                END',
                [$q, $q.'%']
            );
        }

        if (filter_var($request->query('awaiting_ot'), FILTER_VALIDATE_BOOLEAN)) {
            $query->awaitingProductionOt();
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function store(StoreClientOrderRequest $request): JsonResponse
    {
        $data = $request->validated();
        $linesInput = $data['lines'] ?? [];
        unset($data['lines']);

        $data['code'] = $data['code'] ?? ClientOrder::nextCode();
        $data['status'] = $data['status'] ?? ClientOrderStatus::Open->value;
        $data['created_by'] = $request->user()->getKey();

        $order = DB::transaction(function () use ($data, $linesInput) {
            /** @var ClientOrder $order */
            $order = ClientOrder::query()->create($data);
            $this->persistLines($order, $linesInput);

            return $order;
        });

        return response()->json($order->load(['client', 'lines.product', 'lines.material']), 201);
    }

    public function show(ClientOrder $client_order): JsonResponse
    {
        $client_order->load([
            'client',
            'lines.product',
            'lines.material',
            'workOrders' => fn ($q) => $q->orderByDesc('id')->limit(50),
        ]);

        return response()->json($client_order);
    }

    public function update(UpdateClientOrderRequest $request, ClientOrder $client_order): JsonResponse
    {
        $data = $request->validated();
        $linesProvided = array_key_exists('lines', $data);
        $linesInput = $data['lines'] ?? [];
        unset($data['lines']);

        DB::transaction(function () use ($client_order, $data, $linesProvided, $linesInput) {
            if ($data !== []) {
                $client_order->update($data);
            }
            if ($linesProvided) {
                $client_order->lines()->delete();
                $this->persistLines($client_order->fresh(), $linesInput);
            }
        });

        return response()->json($client_order->fresh()->load(['client', 'lines.product', 'lines.material']));
    }

    /**
     * @param  list<array<string, mixed>>  $linesInput
     */
    private function persistLines(ClientOrder $order, array $linesInput): void
    {
        foreach (array_values($linesInput) as $position => $line) {
            if (! is_array($line)) {
                continue;
            }
            ClientOrderLine::query()->create([
                'client_order_id' => $order->getKey(),
                'product_id' => isset($line['product_id']) ? (int) $line['product_id'] : null,
                'material_id' => isset($line['material_id']) ? (int) $line['material_id'] : null,
                'description' => $line['description'] ?? null,
                'quantity' => $line['quantity'],
                'unit' => $line['unit'] ?? 'kg',
                'notes' => $line['notes'] ?? null,
                'position' => $position,
            ]);
        }
    }
}
