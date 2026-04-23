<?php

namespace App\Services;

use App\Enums\InventoryArea;
use App\Enums\InventoryMovementType;
use App\Enums\PurchaseOrderStatus;
use App\Enums\WorkOrderBoardStage;
use App\Enums\WorkOrderSchedulingStatus;
use App\Enums\WorkOrderStatus;
use App\Models\Client;
use App\Models\ClientOrder;
use App\Models\ClientOrderLine;
use App\Models\GateMovement;
use App\Models\InventoryReturn;
use App\Models\Material;
use App\Models\MaterialRequest;
use App\Models\MaterialRequestLine;
use App\Models\MiscellaneousReceipt;
use App\Models\MiscellaneousReceiptAttachment;
use App\Models\OperationalAlert;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\PurchaseReceipt;
use App\Models\PurchaseReceiptLine;
use App\Models\Supplier;
use App\Models\TintaMixture;
use App\Models\TintaMixtureComponent;
use App\Models\User;
use App\Models\Vendor;
use App\Models\WorkOrder;
use App\Models\WorkOrderLine;
use App\Models\WorkOrderProductionItem;
use App\Models\WorkOrderQualityRecord;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AxonesDemoDataService
{
    public function __construct(
        private readonly InventoryLedgerService $ledger,
        private readonly PurchaseReceiptService $purchaseReceipts,
        private readonly MaterialRequestService $materialRequests,
    ) {}

    public function seed(): array
    {
        // TRUNCATE hace commit implícito en MySQL: no lo corremos dentro de transacción.
        $this->cleanDomainData(keepUsers: true);

        return DB::transaction(function () {

            $users = $this->seedUsers();
            $boss = $users['boss'];
            $inventoryUser = $users['inventory'];
            $printingUser = $users['printing'];

            $vendors = $this->seedVendors();
            $clients = $this->seedClients($vendors);
            $suppliers = $this->seedSuppliers();

            $materials = $this->seedMaterials($inventoryUser);
            $products = $this->seedProducts($clients);

            $purchaseOrders = $this->seedPurchaseOrdersAndReceipts($suppliers, $materials, $inventoryUser);
            $this->seedMiscReceipts($materials, $inventoryUser);
            $this->seedGateMovements($boss);

            $clientOrders = $this->seedClientOrders($clients, $products, $materials);
            $workOrders = $this->seedWorkOrders($clientOrders, $clients, $products, $materials, $printingUser);

            $this->seedRequestsAndDispatch($workOrders, $materials, $inventoryUser);
            $this->seedQuality($workOrders, $boss);
            $this->seedReturnsAndRejectedBobinas($workOrders, $materials, $printingUser);
            $this->seedAlerts($boss);

            return [
                'users' => array_map(fn (User $u) => $u->only(['id', 'name', 'email', 'role']), $users),
                'clients' => count($clients),
                'suppliers' => count($suppliers),
                'products' => count($products),
                'materials' => count($materials),
                'purchase_orders' => count($purchaseOrders),
                'work_orders' => count($workOrders),
            ];
        });
    }

    public function clean(): void
    {
        // TRUNCATE hace commit implícito en MySQL: no lo corremos dentro de transacción.
        $this->cleanDomainData(keepUsers: false);
        $this->deleteDemoUsers();
    }

    private function seedUsers(): array
    {
        $mk = function (string $email, string $name, string $role): User {
            return User::query()->updateOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'role' => $role,
                    'password' => Hash::make('password'),
                ],
            );
        };

        return [
            'boss' => $mk('boss@axones.demo', 'Jefe Supremo (demo)', 'boss'),
            'inventory' => $mk('inventario@axones.demo', 'Inventario (demo)', 'inventory'),
            'printing' => $mk('impresion@axones.demo', 'Impresión (demo)', 'impresion'),
            'laminacion' => $mk('laminacion@axones.demo', 'Laminación (demo)', 'laminacion'),
            'corte' => $mk('corte@axones.demo', 'Corte (demo)', 'corte'),
            'tintas' => $mk('tintas@axones.demo', 'Tintas (demo)', 'tintas'),
            'quality' => $mk('calidad@axones.demo', 'Calidad (demo)', 'calidad'),
            'gate' => $mk('vigilancia@axones.demo', 'Vigilancia (demo)', 'vigilancia'),
            'solicitante' => $mk('solicitante@axones.demo', 'Solicitante (demo)', 'solicitante'),

            // Cuentas locales (axones.local) para demos rápidas sin depender de emails .demo
            'boss_local' => $mk('boss@axones.local', 'Jefe Supremo', 'boss'),
            'inventory_local' => $mk('inventario@axones.local', 'Axones Inventario', 'inventory'),
            'printing_local' => $mk('impresion@axones.local', 'Axones Impresión', 'impresion'),
            'laminacion_local' => $mk('laminacion@axones.local', 'Axones Laminación', 'laminacion'),
            'corte_local' => $mk('corte@axones.local', 'Axones Corte', 'corte'),
            'tintas_local' => $mk('tintas@axones.local', 'Axones Tintas', 'tintas'),
            'quality_local' => $mk('calidad@axones.local', 'Axones Calidad', 'calidad'),
            'gate_local' => $mk('vigilancia@axones.local', 'Axones Vigilancia', 'vigilancia'),
        ];
    }

    private function deleteDemoUsers(): void
    {
        User::query()->where('email', 'like', '%@axones.demo')->delete();
    }

    /**
     * @param array<int, Vendor> $vendors
     * @return array<int, Client>
     */
    private function seedClients(array $vendors): array
    {
        return [
            Client::query()->create([
                'name' => 'Millennium C.A.',
                'rif' => 'J-12345678-9',
                'state' => 'Portuguesa',
                'city' => 'Acarigua',
                'vendor_id' => $vendors[0]->getKey(),
                'address' => 'Zona Industrial, Portuguesa',
                'vendor_name' => 'Vendedor Demo',
                'email' => 'compras@millennium.demo',
                'phone' => '+58 412-0000000',
            ]),
            Client::query()->create([
                'name' => 'Supermercado La Plaza',
                'rif' => 'J-98765432-1',
                'state' => 'Portuguesa',
                'city' => 'Guanare',
                'vendor_id' => $vendors[1]->getKey(),
                'address' => 'Centro, Portuguesa',
                'vendor_name' => 'Vendedor Demo',
                'email' => 'admin@plaza.demo',
                'phone' => '+58 414-0000000',
            ]),
        ];
    }

    /**
     * @return array<int, Vendor>
     */
    private function seedVendors(): array
    {
        return [
            Vendor::query()->create(['name' => 'Vendedor Demo', 'active' => true]),
            Vendor::query()->create(['name' => 'Vendedor Demo 2', 'active' => true]),
            Vendor::query()->create(['name' => 'Vendedor Demo 3', 'active' => true]),
        ];
    }

    private function seedSuppliers(): array
    {
        return [
            Supplier::query()->create([
                'name' => 'Proveedor Polímeros',
                'rif' => 'J-11111111-1',
                'email' => 'ventas@polimeros.demo',
                'phone' => '+58 424-0000000',
                'address' => 'Valencia, Carabobo',
            ]),
            Supplier::query()->create([
                'name' => 'Proveedor Tintas',
                'rif' => 'J-22222222-2',
                'email' => 'ventas@tintas.demo',
                'phone' => '+58 426-0000000',
                'address' => 'Maracay, Aragua',
            ]),
        ];
    }

    private function seedMaterials(User $inventoryUser): array
    {
        $make = function (string $sku, string $name, string $area, string $unit, string $min, string $initial) use ($inventoryUser): Material {
            $m = Material::query()->create([
                'sku' => $sku,
                'name' => $name,
                'inventory_area' => $area,
                'unit' => $unit,
                'min_stock' => $min,
                'notes' => 'demo',
            ]);
            if (bccomp($initial, '0', 3) === 1) {
                $this->ledger->apply(
                    $m,
                    InventoryMovementType::AdjustmentAdd,
                    $initial,
                    $inventoryUser,
                    'demo_seed',
                    (int) $m->getKey(),
                    ['reason' => 'Stock inicial demo'],
                );
            }
            return $m;
        };

        $out = [];

        // Material
        $out[] = $make('MAT-PEBD-25', 'PEBD 25 micras', InventoryArea::Material->value, 'kg', '500.000', '1200.000');
        $out[] = $make('MAT-BOPP-20', 'BOPP 20 micras', InventoryArea::Material->value, 'kg', '300.000', '800.000');

        // Tintas
        $out[] = $make('TIN-BLK', 'Tinta Negro', InventoryArea::Tintas->value, 'kg', '10.000', '80.000');
        $out[] = $make('TIN-RED', 'Tinta Rojo', InventoryArea::Tintas->value, 'kg', '10.000', '60.000');

        // Cementerio
        $out[] = $make('CEM-MIX-01', 'Sobrante mezcla OT', InventoryArea::CementerioTintas->value, 'kg', '0.000', '15.000');

        // Químicos
        $out[] = $make('Q-ALC', 'Alcohol', InventoryArea::Quimicos->value, 'kg', '5.000', '40.000');
        $out[] = $make('Q-NPA', 'NPA', InventoryArea::Quimicos->value, 'kg', '5.000', '30.000');

        // Bobinas rechazadas (inventario)
        $out[] = $make('BR-001', 'Bobina rechazada genérica', InventoryArea::BobinasRechazadas->value, 'kg', '0.000', '0.000');

        // Misceláneos
        $out[] = $make('MIS-CINTA', 'Cinta adhesiva', InventoryArea::Miscelaneos->value, 'u', '20.000', '100.000');
        $out[] = $make('MIS-GUANTE', 'Guantes', InventoryArea::Miscelaneos->value, 'caja', '5.000', '25.000');

        return $out;
    }

    private function seedProducts(array $clients): array
    {
        return [
            Product::query()->create([
                'client_id' => $clients[0]->getKey(),
                'name' => 'Empaque salchichas 500g',
                'cpe' => 'CPE-500',
                'barcode' => '1234567890123',
                'mps' => 'MPS-500',
                'print_type' => 'Flexografía',
                'structure' => 'BOPP 20 + PEBD 25',
            ]),
            Product::query()->create([
                'client_id' => $clients[1]->getKey(),
                'name' => 'Etiqueta precio',
                'cpe' => 'CPE-ETQ',
                'barcode' => '9876543210987',
                'mps' => 'MPS-ETQ',
                'print_type' => 'Flexografía',
                'structure' => 'Papel + adhesivo',
            ]),
        ];
    }

    private function seedPurchaseOrdersAndReceipts(array $suppliers, array $materials, User $inventoryUser): array
    {
        $po1 = PurchaseOrder::query()->create([
            'supplier_id' => $suppliers[0]->getKey(),
            'code' => 'OC-DEMO-001',
            'status' => PurchaseOrderStatus::Open->value,
            'ordered_at' => now()->subDays(4),
            'notes' => 'OC demo',
        ]);
        $line1 = PurchaseOrderLine::query()->create([
            'purchase_order_id' => $po1->getKey(),
            'description' => 'Material PEBD',
            'material_id' => $materials[0]->getKey(),
            'quantity_ordered' => '500.000',
            'quantity_received' => '0.000',
            'unit' => 'kg',
        ]);
        $line2 = PurchaseOrderLine::query()->create([
            'purchase_order_id' => $po1->getKey(),
            'description' => 'BOPP',
            'material_id' => $materials[1]->getKey(),
            'quantity_ordered' => '300.000',
            'quantity_received' => '0.000',
            'unit' => 'kg',
        ]);

        // Registrar recepción casada con OC usando el service (actualiza inventario y cantidades recibidas)
        $receipt = $this->purchaseReceipts->store([
            'purchase_order_id' => $po1->getKey(),
            'without_purchase_order' => false,
            'notes' => 'Recepción demo',
            'received_at' => now()->subDays(3)->toDateTimeString(),
            'lines' => [
                [
                    'purchase_order_line_id' => $line1->getKey(),
                    'material_id' => $materials[0]->getKey(),
                    'quantity' => '200.000',
                    'bobina_count' => 4,
                ],
                [
                    'purchase_order_line_id' => $line2->getKey(),
                    'material_id' => $materials[1]->getKey(),
                    'quantity' => '150.000',
                    'bobina_count' => 3,
                ],
            ],
        ], $inventoryUser);

        // Segunda recepción sin OC (stock)
        $receipt2 = $this->purchaseReceipts->store([
            'without_purchase_order' => true,
            'exception_reason' => 'Stock de seguridad demo',
            'notes' => 'Recepción sin OC demo',
            'received_at' => now()->subDays(2)->toDateTimeString(),
            'lines' => [
                [
                    'material_id' => $materials[2]->getKey(),
                    'quantity' => '10.000',
                ],
                [
                    'material_id' => $materials[5]->getKey(),
                    'quantity' => '5.000',
                ],
            ],
        ], $inventoryUser);

        // Persist objects for counts
        return [$po1->fresh(), $receipt->fresh(), $receipt2->fresh()];
    }

    private function seedMiscReceipts(array $materials, User $inventoryUser): void
    {
        // Crear archivo demo para adjuntar
        $dir = 'demo_files';
        Storage::disk('local')->put($dir.'/factura-demo.txt', 'Factura demo Axones');
        $path = Storage::disk('local')->path($dir.'/factura-demo.txt');

        $receipt = MiscellaneousReceipt::query()->create([
            'material_id' => $materials[array_key_last($materials)]->getKey(),
            'quantity' => '10.000',
            'user_id' => $inventoryUser->getKey(),
            'invoice_reference' => 'FAC-DEMO-001',
            'notes' => 'Ingreso misceláneo demo',
            'received_at' => now()->subDay(),
        ]);

        $stored = Storage::disk('local')->putFileAs(
            'miscellaneous_receipts/'.$receipt->getKey(),
            new \Illuminate\Http\File($path),
            'factura-demo.txt',
        );

        MiscellaneousReceiptAttachment::query()->create([
            'miscellaneous_receipt_id' => $receipt->getKey(),
            'disk' => 'local',
            'path' => $stored,
            'original_name' => 'factura-demo.txt',
            'mime_type' => 'text/plain',
            'size_bytes' => Storage::disk('local')->size($stored),
        ]);

        $this->ledger->apply(
            $receipt->material,
            InventoryMovementType::In,
            (string) $receipt->quantity,
            $inventoryUser,
            'miscellaneous_receipt',
            (int) $receipt->getKey(),
            ['invoice_reference' => $receipt->invoice_reference],
            $receipt->received_at,
        );
    }

    private function seedGateMovements(User $boss): void
    {
        GateMovement::query()->create([
            'direction' => 'in',
            'notes' => 'Camión proveedor (demo)',
            'photo_path' => null,
            'user_id' => $boss->getKey(),
            'occurred_at' => now()->subHours(6),
        ]);
        GateMovement::query()->create([
            'direction' => 'out',
            'notes' => 'Salida de despacho (demo)',
            'photo_path' => null,
            'user_id' => $boss->getKey(),
            'occurred_at' => now()->subHours(2),
        ]);
    }

    private function seedClientOrders(array $clients, array $products, array $materials): array
    {
        $co = ClientOrder::query()->create([
            'client_id' => $clients[0]->getKey(),
            'code' => 'PC-DEMO-001',
            'status' => 'open',
            'notes' => 'Pedido cliente demo',
        ]);

        ClientOrderLine::query()->create([
            'client_order_id' => $co->getKey(),
            'product_id' => $products[0]->getKey(),
            'material_id' => $materials[0]->getKey(),
            'quantity' => '500.000',
            'unit' => 'kg',
            'notes' => 'Requiere material PEBD',
        ]);

        return [$co->fresh()];
    }

    private function seedWorkOrders(array $clientOrders, array $clients, array $products, array $materials, User $printingUser): array
    {
        $wo1 = WorkOrder::query()->create([
            'code' => 'OT-DEMO-001',
            'client_order_reference' => $clientOrders[0]->code,
            'client_order_id' => $clientOrders[0]->getKey(),
            'client_id' => $clients[0]->getKey(),
            'product_id' => $products[0]->getKey(),
            'status' => WorkOrderStatus::Open->value,
            'scheduling_status' => WorkOrderSchedulingStatus::PendingProgramming->value,
            'board_stage' => WorkOrderBoardStage::Nueva->value,
            'notes' => 'OT demo en pendiente por OT',
            'created_by' => $printingUser->getKey(),
            'document_number' => WorkOrder::nextDocumentNumber(),
            'document_date' => now()->toDateString(),
        ]);

        WorkOrderLine::query()->create([
            'work_order_id' => $wo1->getKey(),
            'material_id' => $materials[0]->getKey(),
            'quantity' => '120.000',
            'notes' => 'Consumo estimado',
        ]);

        WorkOrderProductionItem::query()->create([
            'work_order_id' => $wo1->getKey(),
            'position' => 0,
            'quantity' => '500.000',
            'quantity_unit' => 'Kg',
            'product_description' => 'Empaque salchichas 500g',
            'technical_specs' => 'Flexografía · 4 colores',
        ]);

        // OT2 ya en impresión para ver pantalla por área
        $wo2 = WorkOrder::query()->create([
            'code' => 'OT-DEMO-002',
            'client_order_reference' => 'PC-DEMO-002',
            'client_id' => $clients[1]->getKey(),
            'product_id' => $products[1]->getKey(),
            'status' => WorkOrderStatus::InProgress->value,
            'scheduling_status' => WorkOrderSchedulingStatus::InProgramming->value,
            'board_stage' => WorkOrderBoardStage::Impresion->value,
            'notes' => 'OT demo en impresión',
            'created_by' => $printingUser->getKey(),
            'document_number' => WorkOrder::nextDocumentNumber(),
            'document_date' => now()->toDateString(),
        ]);

        // OT3 en laminación
        $wo3 = WorkOrder::query()->create([
            'code' => 'OT-DEMO-003',
            'client_order_reference' => 'PC-DEMO-003',
            'client_id' => $clients[0]->getKey(),
            'product_id' => $products[0]->getKey(),
            'status' => WorkOrderStatus::InProgress->value,
            'scheduling_status' => WorkOrderSchedulingStatus::InProgramming->value,
            'board_stage' => WorkOrderBoardStage::Laminacion->value,
            'notes' => 'OT demo en laminación',
            'created_by' => $printingUser->getKey(),
            'document_number' => WorkOrder::nextDocumentNumber(),
            'document_date' => now()->toDateString(),
        ]);

        // OT4 en corte
        $wo4 = WorkOrder::query()->create([
            'code' => 'OT-DEMO-004',
            'client_order_reference' => 'PC-DEMO-004',
            'client_id' => $clients[0]->getKey(),
            'product_id' => $products[0]->getKey(),
            'status' => WorkOrderStatus::InProgress->value,
            'scheduling_status' => WorkOrderSchedulingStatus::InProgramming->value,
            'board_stage' => WorkOrderBoardStage::Corte->value,
            'notes' => 'OT demo en corte',
            'created_by' => $printingUser->getKey(),
            'document_number' => WorkOrder::nextDocumentNumber(),
            'document_date' => now()->toDateString(),
        ]);

        // OT5 en montaje (para esa pestaña en detalle OT)
        $wo5 = WorkOrder::query()->create([
            'code' => 'OT-DEMO-005',
            'client_order_reference' => 'PC-DEMO-005',
            'client_id' => $clients[1]->getKey(),
            'product_id' => $products[1]->getKey(),
            'status' => WorkOrderStatus::InProgress->value,
            'scheduling_status' => WorkOrderSchedulingStatus::InProgramming->value,
            'board_stage' => WorkOrderBoardStage::Montaje->value,
            'notes' => 'OT demo en montaje',
            'created_by' => $printingUser->getKey(),
            'document_number' => WorkOrder::nextDocumentNumber(),
            'document_date' => now()->toDateString(),
        ]);

        return [$wo1->fresh(), $wo2->fresh(), $wo3->fresh(), $wo4->fresh(), $wo5->fresh()];
    }

    private function seedRequestsAndDispatch(array $workOrders, array $materials, User $inventoryUser): void
    {
        // Crear solicitud material para OT2 y despachar parcial
        $wo = $workOrders[1];

        $mr = $this->materialRequests->storePendingRequest(
            $wo->fresh(),
            $inventoryUser,
            [
                ['material_id' => $materials[0]->getKey(), 'quantity_requested' => '20.000'],
                ['material_id' => $materials[2]->getKey(), 'quantity_requested' => '2.000'],
            ],
            'printing',
            'Solicitud demo desde OT',
            now()->toDateString(),
            null,
            'IMP-01',
        );

        $this->materialRequests->authorizeRequest($mr, $inventoryUser);

        $lines = $mr->lines()->get();
        $dispatchLines = $lines->map(fn (MaterialRequestLine $l) => [
            'material_request_line_id' => $l->getKey(),
            'quantity' => $l->quantity_requested,
        ])->all();

        $this->materialRequests->dispatch($mr, $dispatchLines, $inventoryUser);
    }

    private function seedQuality(array $workOrders, User $boss): void
    {
        WorkOrderQualityRecord::query()->updateOrCreate(
            ['work_order_id' => $workOrders[1]->getKey()],
            [
                'outcome' => 'approved',
                'notes' => 'Calidad demo',
                'created_by' => $boss->getKey(),
                'updated_by' => $boss->getKey(),
            ],
        );
    }

    private function seedReturnsAndRejectedBobinas(array $workOrders, array $materials, User $printingUser): void
    {
        // Devolución demo: destino bobinas_rechazadas (requiere work_order_id)
        $rejectedMat = collect($materials)->first(
            fn (Material $m) => $m->inventory_area === InventoryArea::BobinasRechazadas->value
        );
        if (! $rejectedMat) {
            return;
        }

        InventoryReturn::query()->create([
            'material_id' => $rejectedMat->getKey(),
            'work_order_id' => $workOrders[1]->getKey(),
            'destination_area' => InventoryArea::BobinasRechazadas->value,
            'quantity' => '5.000',
            'status' => 'pending',
            'reason' => 'Bobinas rechazadas (demo)',
        ]);
    }

    private function seedAlerts(User $boss): void
    {
        OperationalAlert::query()->create([
            'alert_type' => 'mount_time_exceeded',
            'severity' => 'info',
            'message' => 'Datos demo cargados.',
            'metadata' => ['tag' => 'demo'],
            'created_by' => $boss->getKey(),
        ]);
    }

    private function cleanDomainData(bool $keepUsers): void
    {
        $tables = [
            'area_requests',
            'bobinas',
            'client_order_lines',
            'client_orders',
            'corte_bobina_usages',
            'corte_time_segments',
            'delivery_note_lines',
            'delivery_notes',
            'gate_movements',
            'inventory_movements',
            'inventory_returns',
            'laminacion_bobina_usages',
            'laminacion_time_segments',
            'material_request_lines',
            'material_requests',
            'miscellaneous_receipt_attachments',
            'miscellaneous_receipts',
            'operational_alerts',
            'printing_bobina_usages',
            'printing_chemical_usages',
            'printing_ink_control_lines',
            'printing_time_segments',
            'purchase_receipt_lines',
            'purchase_receipts',
            'purchase_order_lines',
            'purchase_orders',
            'materials',
            'tinta_mixture_components',
            'tinta_mixtures',
            'work_order_quality_records',
            'work_order_corte_summaries',
            'work_order_laminacion_summaries',
            'work_order_montaje_summaries',
            'work_order_printing_summaries',
            'work_order_production_items',
            'work_order_lines',
            'work_order_technical_documents',
            'work_orders',
            'products',
            'suppliers',
            'clients',
            'vendors',
        ];

        $driver = DB::connection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        } elseif ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = OFF;');
        }

        foreach ($tables as $t) {
            DB::table($t)->truncate();
        }

        if ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');
        } elseif ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        }

        Storage::disk('local')->deleteDirectory('miscellaneous_receipts');
        Storage::disk('local')->deleteDirectory('gate_photos');
        Storage::disk('local')->deleteDirectory('demo_files');

        if (! $keepUsers) {
            // no-op: users se limpian por deleteDemoUsers()
        }
    }
}

