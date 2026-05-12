<?php

namespace App\Services;

use App\Enums\InventoryArea;
use App\Enums\InventoryMovementType;
use App\Enums\PrintingChemicalType;
use App\Enums\PurchaseOrderStatus;
use App\Enums\WorkOrderBoardStage;
use App\Enums\WorkOrderSchedulingStatus;
use App\Enums\WorkOrderStatus;
use App\Models\AreaRequest;
use App\Models\Bobina;
use App\Models\Client;
use App\Models\ClientOrder;
use App\Models\ClientOrderLine;
use App\Models\CorteBobinaUsage;
use App\Models\CorteTimeSegment;
use App\Models\DeliveryNote;
use App\Models\DeliveryNoteLine;
use App\Models\GateMovement;
use App\Models\InventoryReturn;
use App\Models\LaminacionBobinaUsage;
use App\Models\LaminacionTimeSegment;
use App\Models\Material;
use App\Models\MaterialRequestLine;
use App\Models\MiscellaneousReceipt;
use App\Models\MiscellaneousReceiptAttachment;
use App\Models\MontajeMaterialUsage;
use App\Models\MontajeTimeSegment;
use App\Models\OperationalAlert;
use App\Models\PrintingBobinaUsage;
use App\Models\PrintingChemicalUsage;
use App\Models\PrintingInkControlLine;
use App\Models\PrintingTimeSegment;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\PurchaseReceipt;
use App\Models\Supplier;
use App\Models\TintaMixture;
use App\Models\TintaMixtureComponent;
use App\Models\TintasTimeSegment;
use App\Models\TintaSubarea;
use App\Models\User;
use App\Models\Vendor;
use App\Models\WorkOrder;
use App\Models\WorkOrderCorteSummary;
use App\Models\WorkOrderLaminacionSummary;
use App\Models\WorkOrderLine;
use App\Models\WorkOrderMontajeSummary;
use App\Models\WorkOrderPrintingSummary;
use App\Models\WorkOrderProductionItem;
use App\Models\WorkOrderQualityRecord;
use App\Models\WorkOrderTechnicalDocument;
use App\Models\WorkOrderTintasSummary;
use App\Support\DemoTintaCatalogRows;
use Carbon\Carbon;
use Illuminate\Http\File;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class AxonesDemoDataService
{
    private int $demoVolume = 20;

    /** Solo datos mínimos para comparar especificación vs terminado (sin volumen demo masivo). */
    private bool $minimalComparisonSeed = false;

    /** Una fila por bucle de volumen (volumen=1) pero con pedido/OT y grafo de producción para recorrer impresión/laminación/corte/tintas. */
    private bool $microSeed = false;

    public function __construct(
        private readonly InventoryLedgerService $ledger,
        private readonly PurchaseReceiptService $purchaseReceipts,
        private readonly MaterialRequestService $materialRequests,
    ) {}

    /**
     * @param  int  $demoVolume  Filas objetivo por tabla de dominio (1–200 en modo comparación; 5–200 en modo volumen).
     * @param  bool  $minimalComparison  Si true: pocas filas, sin catálogo masivo de tintas ni grafo pesado (una sola línea típica en despacho tras OT-DEMO-FLUJO).
     * @param  bool  $micro  Si true: volumen 1 por tabla iterada, materiales «minimal», sí cliente/producto/OT y grafo (ideal para phpMyAdmin / pruebas rápidas).
     */
    public function seed(int $demoVolume = 20, bool $minimalComparison = false, bool $micro = false): array
    {
        $this->applyDemoVolumeSettings($demoVolume, $minimalComparison, $micro);
        // TRUNCATE hace commit implícito en MySQL: no lo corremos dentro de transacción.
        $this->cleanDomainData(keepUsers: true);

        return DB::transaction(function () {

            $users = $this->seedUsers();
            $boss = $users['boss'];
            $inventoryUser = $users['inventory'];
            $printingUser = $users['printing'];

            $ctx = $this->phaseMastersInternal($inventoryUser);

            $purchaseOrders = $this->phaseComprasInternal($ctx['suppliers'], $ctx['materials'], $inventoryUser);

            $invExtra = $this->phaseInventarioExtraInternal($ctx['materials'], $inventoryUser, $boss);
            $bobinas = $invExtra['bobinas'];

            if ($this->minimalComparisonSeed) {
                $workOrders = [];
            } else {
                $ventas = $this->phaseVentasOtInternal($ctx['clients'], $ctx['products'], $ctx['materials'], $printingUser);
                $workOrders = $ventas['work_orders'];
            }

            $this->phaseOperacionesInternal($workOrders, $ctx['materials'], $inventoryUser, $boss);
            $this->seedAlerts($boss);

            if (! $this->minimalComparisonSeed) {
                $this->phaseGrafoDemoInternal($workOrders, $ctx['materials'], $bobinas, $printingUser, $boss);
                $this->phaseAuxiliaryVolumeInternal($workOrders, $ctx['materials'], $ctx['products'], $ctx['suppliers'], $printingUser, $inventoryUser, $boss);
            }

            return [
                'users' => array_map(fn (User $u) => $u->only(['id', 'name', 'email', 'role']), $users),
                'vendors' => count($ctx['vendors']),
                'clients' => count($ctx['clients']),
                'suppliers' => count($ctx['suppliers']),
                'products' => count($ctx['products']),
                'materials' => count($ctx['materials']),
                'purchase_orders' => count($purchaseOrders),
                'work_orders' => count($workOrders),
                'bobinas' => count($bobinas),
                'demo_volume' => $this->demoVolume,
                'minimal_comparison' => $this->minimalComparisonSeed,
                'micro_seed' => $this->microSeed,
            ];
        });
    }

    public function clean(): void
    {
        // TRUNCATE hace commit implícito en MySQL: no lo corremos dentro de transacción.
        $this->cleanDomainData(keepUsers: false);
        $this->deleteDemoUsers();
    }

    /**
     * Vacía tablas de dominio (clients, materials, work_orders, etc.) y conserva la tabla users.
     * Recrea solo usuarios demo conocidos (emails @axones.demo y @axones.local) con contraseña «password».
     * No inserta proveedores, materiales, pedidos ni órdenes: sirve para recorrer el flujo completo en la UI.
     *
     * @return array{users: array<int, array{id: int, name: string, email: string, role: string}>}
     */
    public function resetDomainForManualProcedure(): array
    {
        $this->cleanDomainData(keepUsers: true);
        $users = $this->seedUsers();

        return [
            'users' => array_values(array_map(
                fn (User $u) => $u->only(['id', 'name', 'email', 'role']),
                $users,
            )),
        ];
    }

    /**
     * Ajusta volumen y modo minimal antes de ejecutar fases o seed completo.
     */
    public function preparePhaseRun(int $demoVolume = 20, bool $minimalComparison = false, bool $micro = false): void
    {
        $this->applyDemoVolumeSettings($demoVolume, $minimalComparison, $micro);
    }

    /**
     * @return array{phase: string, users: list<array{id: int, name: string, email: string, role: string}>}
     */
    public function runPhaseReset(bool $keepUsers = true): array
    {
        $this->cleanDomainData($keepUsers);
        $users = $this->seedUsers();

        return [
            'phase' => 'reset',
            'users' => array_values(array_map(
                fn (User $u) => $u->only(['id', 'name', 'email', 'role']),
                $users,
            )),
        ];
    }

    /**
     * @return array{phase: string, vendors: int, clients: int, suppliers: int, products: int, materials: int}
     */
    public function runPhaseMasters(): array
    {
        return DB::transaction(function (): array {
            $inventoryUser = $this->resolveDemoUsersForPhase()['inventory'];
            $ctx = $this->phaseMastersInternal($inventoryUser);

            return [
                'phase' => 'masters',
                'vendors' => count($ctx['vendors']),
                'clients' => count($ctx['clients']),
                'suppliers' => count($ctx['suppliers']),
                'products' => count($ctx['products']),
                'materials' => count($ctx['materials']),
            ];
        });
    }

    /**
     * @return array{phase: string, purchase_entities: int}
     */
    public function runPhaseCompras(): array
    {
        return DB::transaction(function (): array {
            $u = $this->resolveDemoUsersForPhase();
            $suppliers = Supplier::query()->orderBy('id')->get()->all();
            $materials = Material::query()->orderBy('id')->get()->all();
            if ($suppliers === [] || $materials === []) {
                throw new \RuntimeException('Fase compras: no hay proveedores o materiales. Ejecute primero la fase «masters».');
            }

            $purchaseEntities = $this->phaseComprasInternal($suppliers, $materials, $u['inventory']);

            return [
                'phase' => 'compras',
                'purchase_entities' => count($purchaseEntities),
            ];
        });
    }

    /**
     * @return array{phase: string, bobinas: int}
     */
    public function runPhaseInventarioExtra(): array
    {
        return DB::transaction(function (): array {
            $u = $this->resolveDemoUsersForPhase();
            $materials = Material::query()->orderBy('id')->get()->all();
            if ($materials === []) {
                throw new \RuntimeException('Fase inventario_extra: no hay materiales. Ejecute primero «masters».');
            }
            $inv = $this->phaseInventarioExtraInternal($materials, $u['inventory'], $u['boss']);

            return [
                'phase' => 'inventario_extra',
                'bobinas' => count($inv['bobinas']),
            ];
        });
    }

    /**
     * @return array{phase: string, client_orders: int, work_orders: int}
     */
    public function runPhaseVentasOt(): array
    {
        if ($this->minimalComparisonSeed) {
            throw new \RuntimeException('La fase ventas_ot no aplica en modo --minimal.');
        }

        return DB::transaction(function (): array {
            $u = $this->resolveDemoUsersForPhase();
            $clients = Client::query()->orderBy('id')->get()->all();
            $products = Product::query()->orderBy('id')->get()->all();
            $materials = Material::query()->orderBy('id')->get()->all();
            if ($clients === [] || $products === []) {
                throw new \RuntimeException('Fase ventas_ot: faltan clientes o productos. Ejecute «masters» antes.');
            }
            $ventas = $this->phaseVentasOtInternal($clients, $products, $materials, $u['printing']);

            return [
                'phase' => 'ventas_ot',
                'client_orders' => count($ventas['client_orders']),
                'work_orders' => count($ventas['work_orders']),
            ];
        });
    }

    /**
     * @return array{phase: string, work_orders: int}
     */
    public function runPhaseOperaciones(): array
    {
        return DB::transaction(function (): array {
            $u = $this->resolveDemoUsersForPhase();
            $workOrders = WorkOrder::query()->orderBy('id')->get()->all();
            $materials = Material::query()->orderBy('id')->get()->all();
            if ($materials === []) {
                throw new \RuntimeException('Fase operaciones: no hay materiales. Ejecute «masters» antes.');
            }

            $this->phaseOperacionesInternal($workOrders, $materials, $u['inventory'], $u['boss']);
            $this->seedAlerts($u['boss']);

            return [
                'phase' => 'operaciones',
                'work_orders' => count($workOrders),
            ];
        });
    }

    /**
     * @return array{phase: string, work_orders: int}
     */
    public function runPhaseGrafoDemo(): array
    {
        if ($this->minimalComparisonSeed) {
            throw new \RuntimeException('La fase grafo_demo no aplica en modo --minimal.');
        }

        return DB::transaction(function (): array {
            $u = $this->resolveDemoUsersForPhase();
            $workOrders = WorkOrder::query()->orderBy('id')->get()->all();
            $materials = Material::query()->orderBy('id')->get()->all();
            $bobinas = Bobina::query()->orderBy('id')->get()->all();
            if ($workOrders === []) {
                throw new \RuntimeException('Fase grafo_demo: no hay órdenes de trabajo. Ejecute «ventas_ot» antes.');
            }
            if ($materials === []) {
                throw new \RuntimeException('Fase grafo_demo: no hay materiales.');
            }

            $this->phaseGrafoDemoInternal($workOrders, $materials, $bobinas, $u['printing'], $u['boss']);
            $suppliers = Supplier::query()->orderBy('id')->get()->all();
            $products = Product::query()->orderBy('id')->get()->all();
            $this->phaseAuxiliaryVolumeInternal($workOrders, $materials, $products, $suppliers, $u['printing'], $u['inventory'], $u['boss']);

            return [
                'phase' => 'grafo_demo',
                'work_orders' => count($workOrders),
            ];
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function runPhaseFlow(bool $createFinishedUsage = true): array
    {
        $u = $this->resolveDemoUsersForPhase();
        $payload = $this->seedHighlightedFlowScenario($u['printing'], $u['boss'], $createFinishedUsage);

        return array_merge(['phase' => 'flow'], $payload);
    }

    /**
     * Escenario fijo para comparar en UI o hacer el flujo manual desde Corte.
     * Idempotente si se ejecuta varias veces: elimina la OT y la OC de demo previas y las recrea.
     *
     * @return array{work_order_id: int, work_order_code: string, client_id: int, product_id: int, quantity_finished_kg: string, corte_bobina_usage_id: int|null}
     */
    public function seedHighlightedFlowScenario(User $printingUser, User $boss, bool $createFinishedUsage = true): array
    {
        return DB::transaction(function () use ($printingUser, $boss, $createFinishedUsage): array {
            WorkOrder::query()->where('code', 'OT-DEMO-FLUJO')->delete();

            $existingCo = ClientOrder::query()->where('code', 'OC-CLI-DEMO-FLUJO')->first();
            if ($existingCo) {
                $existingCo->lines()->delete();
                $existingCo->delete();
            }

            $client = Client::query()->updateOrCreate(
                ['rif' => 'J-90000000-9'],
                [
                    'name' => 'Cliente Flujo Demo',
                    'state' => 'Portuguesa',
                    'city' => 'Acarigua',
                    'address' => 'Demo flujo OT-DEMO-FLUJO',
                    'email' => 'cliente.flujo.demo@axones.demo',
                    'phone' => '+58 412-0000000',
                ],
            );

            $product = Product::query()->updateOrCreate(
                [
                    'client_id' => $client->getKey(),
                    'cpe' => 'CPE-DEMO-FLUJO',
                ],
                [
                    'name' => 'BOLSA HARINA 5KG (DEMO FLUJO)',
                    'barcode' => '7590000000123',
                    'mps' => 'MPS-DEMO-FLUJO',
                    'print_type' => 'Bilaminado',
                    'structure' => 'BOPP NORMAL + LDPE (demo)',
                ],
            );

            $clientOrder = ClientOrder::query()->create([
                'client_id' => $client->getKey(),
                'code' => 'OC-CLI-DEMO-FLUJO',
                'status' => 'open',
                'ordered_at' => now()->toDateString(),
                'notes' => 'Pedido demo para OT-DEMO-FLUJO (comparar especificación vs terminado).',
                'created_by' => $boss->getKey(),
            ]);

            ClientOrderLine::query()->create([
                'client_order_id' => $clientOrder->getKey(),
                'product_id' => $product->getKey(),
                'description' => $product->name,
                'quantity' => '100.000',
                'unit' => 'kg',
                'notes' => 'Línea demo flujo',
                'position' => 0,
            ]);

            $matLine = Material::query()
                ->where('inventory_area', InventoryArea::Material->value)
                ->orderBy('id')
                ->first();

            if (! $matLine) {
                throw new \RuntimeException('No hay material de área sustrato tras el seed; no se puede crear OT-DEMO-FLUJO.');
            }

            $bobina = Bobina::query()->orderBy('id')->first();
            if (! $bobina) {
                $bobina = Bobina::query()->create([
                    'material_id' => $matLine->getKey(),
                    'code' => 'BOB-DEMO-FLUJO',
                    'weight_kg' => '500.000',
                    'status' => 'available',
                ]);
            }

            $flowDocNumber = WorkOrder::nextDocumentNumber();

            $wo = WorkOrder::query()->create([
                'code' => 'OT-DEMO-FLUJO',
                'document_number' => $flowDocNumber,
                'document_date' => now()->toDateString(),
                'client_order_reference' => $clientOrder->code,
                'client_order_id' => $clientOrder->getKey(),
                'client_id' => $client->getKey(),
                'product_id' => $product->getKey(),
                'status' => WorkOrderStatus::InProgress->value,
                'scheduling_status' => WorkOrderSchedulingStatus::InProgramming->value,
                'board_stage' => WorkOrderBoardStage::Corte->value,
                'notes' => 'OT DEMO: especificación en maestro vs kg terminados aquí (Corte) y en Despacho.',
                'created_by' => $printingUser->getKey(),
            ]);

            // Precarga de la "Orden de trabajo" (form web) para que /axones/ordenes-trabajo/1?tab=corte
            // muestre la cabecera y el bloque de Corte completos desde el primer render.
            WorkOrderTechnicalDocument::query()->updateOrCreate(
                ['work_order_id' => $wo->getKey()],
                ['form' => [
                    // Cabecera
                    'fechaOrden' => now()->toDateString(),
                    'numeroOrden' => $flowDocNumber,
                    'pedidoKg' => '100.000',
                    'maquina' => 'COMEXI 1',
                    'planchasReferencia' => '067',
                    'metrosEstimados' => '-',

                    // Datos que la UI muestra en "solo lectura" (merge prefill + form)
                    'cliente' => $client->name,
                    'producto' => $product->name,
                    'cpe' => $product->cpe,
                    'estructuraMaterial' => $product->structure,
                    // Evita validación "Seleccione el tipo de impresión."
                    'tipoImpresionEstructura' => 'superficie',
                    // Evita validación "Cod. Barra es obligatorio."
                    'codigoBarra' => '7590000000123',

                    // Área de Corte / Embalaje
                    'anchoCorteFinal' => '320±0',
                    'pesoBobina' => '19-20',
                    'metrosBobina' => '1020 ± 20',
                    'orientacionEmbalaje' => '1',
                    'figuraEmbobinadoCorte' => '1',
                    'ubicFotoceldaCorte' => 'Borde líder',
                    'distFotoceldaBorde' => '1±1',
                    'distFiguraLadoContrario' => '20±1',
                    'distFiguraLadoFotocelda' => '30±1',
                    'maxEmpates' => '1',
                    'diamBobina' => '400 ± 5',
                    'anchoCore' => '460',
                    'diamCorePlg' => '3',
                    'cantCores' => '10',
                    'kgIngresadosCorte' => '100.00',
                    // Según tu ejemplo (puede ser cualquier número válido)
                    'kgSalidaCorte' => '600.10',
                    'kgMermaCorte' => '10.00',
                    'metrajeCorte' => '1000',

                    // Kg desperdicio — historial del reporte (planilla; no viene de inventario/bobinas)
                    'impScrapTransparenteKg' => '3.250',
                    'impScrapImpresoKg' => '20.000',
                    'impScrapImpresoDestino' => 'bopp',
                    'lamScrapTransparenteKg' => '1.000',
                    'lamScrapImpresoKg' => '15.000',
                    'lamScrapLaminadoKg' => '15.000',
                    'corScrapRefileKg' => '10.000',
                    'corScrapImpresoKg' => '10.000',
                    'corScrapMalCorteKg' => '0.000',
                ]],
            );

            WorkOrderLine::query()->create([
                'work_order_id' => $wo->getKey(),
                'material_id' => $matLine->getKey(),
                'quantity' => '100.000',
                'notes' => 'Consumo demo flujo',
            ]);

            WorkOrderProductionItem::query()->create([
                'work_order_id' => $wo->getKey(),
                'position' => 0,
                'quantity' => '100.000',
                'quantity_unit' => 'Kg',
                'product_description' => $product->name.' — ítem producción demo flujo',
                'technical_specs' => 'Demo: ver despacho producto terminado',
            ]);

            WorkOrderCorteSummary::query()->updateOrCreate(
                ['work_order_id' => $wo->getKey()],
                ['scrap_percent' => '0.500', 'notes' => 'Resumen corte (demo flujo)'],
            );

            WorkOrderPrintingSummary::query()->updateOrCreate(
                ['work_order_id' => $wo->getKey()],
                ['scrap_percent' => '1.250', 'notes' => 'Resumen impresión (demo flujo)'],
            );

            WorkOrderLaminacionSummary::query()->updateOrCreate(
                ['work_order_id' => $wo->getKey()],
                [
                    'scrap_percent' => '2.100',
                    'solvent_quantity_kg' => null,
                    'notes' => 'Resumen laminación (demo flujo)',
                ],
            );

            $usage = null;
            if ($createFinishedUsage) {
                $usage = CorteBobinaUsage::query()->create([
                    'work_order_id' => $wo->getKey(),
                    'bobina_id' => $bobina->getKey(),
                    'material_id' => $matLine->getKey(),
                    'quantity_used_kg' => '100.000',
                    'quantity_finished_kg' => '92.000',
                    'notes' => 'Kg terminados demo: saldo despachable 92 kg (sin nota de entrega).',
                ]);
            }

            // Para que /axones/corte muestre la OT en "En mi fase" (mi_area=corte),
            // la API requiere una solicitud de área pendiente.
            AreaRequest::query()->create([
                'area' => 'corte',
                'title' => 'OT-DEMO-FLUJO · Pendiente en Corte',
                'body' => 'Solicitud demo para validar que la OT aparece en /corte y el terminado cae en despacho.',
                'status' => 'pending',
                'work_order_id' => $wo->getKey(),
                'requested_by' => $boss->getKey(),
            ]);

            return [
                'work_order_id' => (int) $wo->getKey(),
                'work_order_code' => 'OT-DEMO-FLUJO',
                'client_id' => (int) $client->getKey(),
                'product_id' => (int) $product->getKey(),
                'quantity_finished_kg' => $createFinishedUsage ? '92.000' : '0.000',
                'corte_bobina_usage_id' => $usage ? (int) $usage->getKey() : null,
            ];
        });
    }

    private function applyDemoVolumeSettings(int $demoVolume, bool $minimalComparison, bool $micro = false): void
    {
        $this->microSeed = $micro;

        if ($minimalComparison) {
            $this->minimalComparisonSeed = true;
            $effectiveVol = $micro ? 1 : ($demoVolume > 0 ? $demoVolume : 1);
            $this->demoVolume = max(1, min(200, $effectiveVol));

            return;
        }

        $this->minimalComparisonSeed = false;

        if ($micro) {
            $this->demoVolume = 1;

            return;
        }

        $this->demoVolume = max(5, min(200, $demoVolume));
    }

    /**
     * @return array{inventory: User, boss: User, printing: User}
     */
    private function resolveDemoUsersForPhase(): array
    {
        $inventory = User::query()->where('email', 'inventario@axones.local')->first()
            ?? User::query()->where('email', 'inventario@axones.demo')->first();
        $boss = User::query()->where('email', 'boss@axones.local')->first()
            ?? User::query()->where('email', 'boss@axones.demo')->first();
        $printing = User::query()->where('email', 'impresion@axones.local')->first()
            ?? User::query()->where('email', 'impresion@axones.demo')->first();

        if (! $inventory || ! $boss || ! $printing) {
            throw new \RuntimeException('No se encontraron usuarios demo (inventario, jefe o impresión). Ejecute primero «php artisan axones:demo:phase reset».');
        }

        return ['inventory' => $inventory, 'boss' => $boss, 'printing' => $printing];
    }

    /**
     * @return array{vendors: list<Vendor>, clients: list<Client>, suppliers: list<Supplier>, materials: list<Material>, products: list<Product>}
     */
    private function phaseMastersInternal(User $inventoryUser): array
    {
        $vendors = $this->seedVendors();
        $clients = $this->minimalComparisonSeed ? [] : $this->seedClients($vendors);
        $suppliers = $this->seedSuppliers();

        $thinMaterials = $this->minimalComparisonSeed || $this->microSeed;
        $materials = $thinMaterials
            ? $this->seedMinimalMaterials($inventoryUser)
            : $this->seedMaterials($inventoryUser);
        $tintaCatalog = $thinMaterials ? [] : $this->seedTintaCatalogMaterials();
        $materials = array_merge($materials, $tintaCatalog);
        $products = $this->minimalComparisonSeed ? [] : $this->seedProducts($clients);
        if (! $this->minimalComparisonSeed && $clients !== []) {
            if (! $this->microSeed) {
                $products = array_merge($products, $this->seedExtraProductsForFirstClient($clients[0]));
            }
            $this->seedProductInkMaterialForDemo($products, $tintaCatalog);
        }

        return compact('vendors', 'clients', 'suppliers', 'materials', 'products');
    }

    /**
     * @param  array<int, Supplier>  $suppliers
     * @param  array<int, Material>  $materials
     * @return list<PurchaseOrder|PurchaseReceipt>
     */
    private function phaseComprasInternal(array $suppliers, array $materials, User $inventoryUser): array
    {
        return $this->seedPurchaseOrdersAndReceipts($suppliers, $materials, $inventoryUser);
    }

    /**
     * @param  array<int, Material>  $materials
     * @return array{bobinas: list<Bobina>}
     */
    private function phaseInventarioExtraInternal(array $materials, User $inventoryUser, User $boss): array
    {
        $this->seedMiscReceipts($materials, $inventoryUser);
        $this->seedGateMovements($boss);
        $bobinas = $this->seedBobinas($materials);

        return ['bobinas' => $bobinas];
    }

    /**
     * @param  array<int, Client>  $clients
     * @param  array<int, Product>  $products
     * @param  array<int, Material>  $materials
     * @return array{client_orders: list<ClientOrder>, work_orders: list<WorkOrder>}
     */
    private function phaseVentasOtInternal(array $clients, array $products, array $materials, User $printingUser): array
    {
        $clientOrders = $this->seedClientOrders($clients, $products, $materials);
        $workOrders = $this->seedWorkOrders($clientOrders, $clients, $products, $materials, $printingUser);

        return [
            'client_orders' => $clientOrders,
            'work_orders' => $workOrders,
        ];
    }

    /**
     * @param  array<int, WorkOrder>  $workOrders
     * @param  array<int, Material>  $materials
     */
    private function phaseOperacionesInternal(array $workOrders, array $materials, User $inventoryUser, User $boss): void
    {
        if ($workOrders === []) {
            return;
        }
        $this->seedRequestsAndDispatch($workOrders, $materials, $inventoryUser);
        $this->seedQuality($workOrders, $boss);
        $this->seedReturnsAndRejectedBobinas($workOrders, $materials);
    }

    /**
     * @param  array<int, WorkOrder>  $workOrders
     * @param  array<int, Material>  $materials
     * @param  array<int, Bobina>  $bobinas
     */
    private function phaseGrafoDemoInternal(
        array $workOrders,
        array $materials,
        array $bobinas,
        User $printingUser,
        User $boss,
    ): void {
        $this->seedHeavyDemoGraph($workOrders, $materials, $bobinas, $printingUser, $boss);
    }

    /**
     * @param  array<int, WorkOrder>  $workOrders
     * @param  array<int, Material>  $materials
     * @param  array<int, Product>  $products
     * @param  array<int, Supplier>  $suppliers
     */
    private function phaseAuxiliaryVolumeInternal(
        array $workOrders,
        array $materials,
        array $products,
        array $suppliers,
        User $printingUser,
        User $inventoryUser,
        User $boss,
    ): void {
        $this->seedAuxiliaryVolume($workOrders, $materials, $products, $suppliers, $printingUser, $inventoryUser, $boss);
    }

    private function seedUsers(): array
    {
        $mk = function (string $email, string $name, string $role): User {
            $base = strtolower((string) preg_replace('/[^a-zA-Z0-9._-]/', '', strstr($email, '@', true) ?: $email));
            $domain = strtolower((string) strstr($email, '@'));
            $suffix = $domain === '@axones.demo' ? '_demo' : '';
            $username = ($base !== '' ? $base : 'user').$suffix;

            return User::query()->updateOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'username' => $username,
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
     * @return array<int, Client>
     */
    /**
     * @return list<Vendor>
     */
    private function seedVendors(): array
    {
        if (! Schema::hasTable('vendors')) {
            return [];
        }

        $n = $this->minimalComparisonSeed
            ? max(1, min($this->demoVolume, 5))
            : $this->demoVolume;

        $out = [];
        for ($i = 1; $i <= $n; $i++) {
            $out[] = Vendor::query()->create([
                'name' => 'Vendedor demo '.$i,
                'phone_primary' => '+58 416-'.str_pad((string) (3000000 + $i), 7, '0', STR_PAD_LEFT),
                'active' => true,
            ]);
        }

        return $out;
    }

    /**
     * @param  array<int, Vendor>  $vendors
     * @return array<int, Client>
     */
    private function seedClients(array $vendors): array
    {
        $out = [];
        $nv = count($vendors);
        for ($i = 1; $i <= $this->demoVolume; $i++) {
            $out[] = Client::query()->create([
                'name' => 'Cliente demo volumen '.$i,
                'rif' => 'J-4'.str_pad((string) (100000 + $i), 7, '0', STR_PAD_LEFT).'-'.($i % 10),
                'state' => 'Portuguesa',
                'city' => 'Acarigua',
                'vendor_id' => $nv > 0 ? $vendors[($i - 1) % $nv]->getKey() : null,
                'address' => 'Zona demo '.$i.', Portuguesa',
                'email' => 'cliente.demo'.$i.'@axones.demo',
                'phone' => '+58 412-'.str_pad((string) (1000000 + $i), 7, '0', STR_PAD_LEFT),
            ]);
        }

        return $out;
    }

    /**
     * @return array<int, Supplier>
     */
    private function seedSuppliers(): array
    {
        $out = [];
        for ($i = 1; $i <= $this->demoVolume; $i++) {
            $out[] = Supplier::query()->create([
                'name' => 'Proveedor demo '.$i,
                'rif' => 'J-5'.str_pad((string) (100000 + $i), 7, '0', STR_PAD_LEFT).'-'.($i % 10),
                'email' => 'ventas.demo'.$i.'@proveedor.axones.demo',
                'phone' => '+58 424-'.str_pad((string) (2000000 + $i), 7, '0', STR_PAD_LEFT),
                'address' => 'Dirección fiscal demo '.$i,
            ]);
        }

        return $out;
    }

    /**
     * Materiales mínimos: dos sustratos (OC demo), una tinta, un químico y bobinas rechazadas (devoluciones demo).
     *
     * @return list<Material>
     */
    private function seedMinimalMaterials(User $inventoryUser): array
    {
        $make = function (string $sku, string $name, string $area, string $unit, string $min, string $initial) use ($inventoryUser): Material {
            $m = Material::query()->create([
                'sku' => $sku,
                'name' => $name,
                'inventory_area' => $area,
                'unit' => $unit,
                'min_stock' => $min,
                'notes' => 'demo_minimal',
            ]);
            if (bccomp($initial, '0', 3) === 1) {
                $this->ledger->apply(
                    $m,
                    InventoryMovementType::AdjustmentAdd,
                    $initial,
                    $inventoryUser,
                    'demo_seed',
                    (int) $m->getKey(),
                    ['reason' => 'Stock inicial demo (minimal)'],
                );
            }

            return $m;
        };

        return [
            $make('AX-MIN-SUB-A', 'Sustrato demo minimal A (BOPP)', InventoryArea::Material->value, 'kg', '5.000', '200.000'),
            $make('AX-MIN-SUB-B', 'Sustrato demo minimal B (PEBD)', InventoryArea::Material->value, 'kg', '5.000', '200.000'),
            $make('AX-MIN-TINTA', 'Tinta demo minimal', InventoryArea::Tintas->value, 'kg', '2.000', '50.000'),
            $make('AX-MIN-QUIM', 'Químico demo minimal', InventoryArea::Quimicos->value, 'kg', '1.000', '30.000'),
            $make('AX-MIN-RECH', 'Bobinas rechazadas (minimal)', InventoryArea::BobinasRechazadas->value, 'kg', '0.000', '0.000'),
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

        $areaCycle = [
            InventoryArea::Material,
            InventoryArea::Material,
            InventoryArea::Tintas,
            InventoryArea::Tintas,
            InventoryArea::Quimicos,
            InventoryArea::Miscelaneos,
            InventoryArea::CementerioTintas,
            InventoryArea::BobinasRechazadas,
        ];

        for ($i = 1; $i <= $this->demoVolume; $i++) {
            $area = $areaCycle[($i - 1) % count($areaCycle)];
            $unit = $area === InventoryArea::Miscelaneos ? 'u' : 'kg';
            $initial = match ($area) {
                InventoryArea::BobinasRechazadas => '0.000',
                InventoryArea::CementerioTintas => '20.000',
                default => '120.000',
            };
            $sku = 'AX-BULK-'.str_pad((string) $i, 4, '0', STR_PAD_LEFT);
            $out[] = $make(
                $sku,
                'Material plancha demo '.$i.' ('.$area->value.')',
                $area->value,
                $unit,
                '5.000',
                $initial,
            );
        }

        return $out;
    }

    /**
     * @param  array<int, Client>  $clients
     * @return array<int, Product>
     */
    private function seedProducts(array $clients): array
    {
        $nc = count($clients);
        $out = [];
        for ($i = 1; $i <= $this->demoVolume; $i++) {
            $out[] = Product::query()->create([
                'client_id' => $clients[($i - 1) % $nc]->getKey(),
                'name' => 'Producto demo '.$i,
                'barcode' => '77099'.str_pad((string) $i, 8, '0', STR_PAD_LEFT),
                'cpe' => 'CPE-DEMO-'.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'mps' => 'MPS-DEMO-'.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'print_type' => 'Flexografía',
                'structure' => 'Estructura demo '.$i,
            ]);
        }

        return $out;
    }

    /**
     * Más de un producto maestro con el mismo `client_id` (primer cliente = «Cliente demo volumen 1») para probar
     * el buscador de producto en la planilla de orden de trabajo.
     *
     * @return list<Product>
     */
    private function seedExtraProductsForFirstClient(Client $firstClient): array
    {
        // Mismo `client_id` que «Cliente demo volumen 1» (primer cliente) para probar el desplegable:
        // ya existe «Producto demo 1» (seedProducts); aquí: Arroz / Salsa / Maripán y un extra.
        $rows = [
            ['name' => 'Polar Tuca — Arroz 1kg', 'barcode' => '7590010000001', 'cpe' => 'CPE-PT-AR-001', 'mps' => 'MPS-PT-AR-001', 'print_type' => 'Flexografía', 'structure' => 'BOPP 25 + PEBD (arroz)'],
            ['name' => 'Polar Tuca — Salsa 400g', 'barcode' => '7590010000002', 'cpe' => 'CPE-PT-SA-001', 'mps' => 'MPS-PT-SA-001', 'print_type' => 'Flexografía', 'structure' => 'BOPP 20 (salsa)'],
            ['name' => 'Polar Tuca — Maripán 6u', 'barcode' => '7590010000003', 'cpe' => 'CPE-PT-MA-001', 'mps' => 'MPS-PT-MA-001', 'print_type' => 'Flexografía', 'structure' => 'BOPP 18 (maripán)'],
            ['name' => 'Polar Tuca — Salchichas 500g', 'barcode' => '7590010000004', 'cpe' => 'CPE-PT-SS-001', 'mps' => 'MPS-PT-SS-001', 'print_type' => 'Flexografía', 'structure' => 'PE/PE 90 + impresión carnes'],
        ];
        $out = [];
        foreach ($rows as $r) {
            $out[] = Product::query()->create([
                'client_id' => $firstClient->getKey(),
                'name' => $r['name'],
                'barcode' => $r['barcode'],
                'cpe' => $r['cpe'],
                'mps' => $r['mps'],
                'print_type' => $r['print_type'],
                'structure' => $r['structure'],
            ]);
        }

        return $out;
    }

    /**
     * Catálogo de tintas (área `tintas`) para el desplegable de planilla y filtro por producto.
     *
     * @return list<Material>
     */
    private function seedTintaCatalogMaterials(): array
    {
        $out = [];
        foreach (DemoTintaCatalogRows::all() as $r) {
            $sku = trim($r['sku']);
            if ($sku === '') {
                continue;
            }
            $name = $r['name'].' — '.$r['presentacion'];
            $n = 0;
            $uniqueSku = $sku;
            while (Material::query()->where('sku', $uniqueSku)->exists()) {
                $n++;
                $uniqueSku = $sku.'-'.$n;
            }
            $material = Material::query()->create([
                'sku' => $uniqueSku,
                'name' => $name,
                'inventory_area' => InventoryArea::Tintas->value,
                'unit' => 'kg',
                'min_stock' => 0,
                'notes' => 'Catálogo planilla (demo/real Axones)',
            ]);

            $legacy = mb_strtolower(trim((string) ($r['presentacion'] ?? '')));
            $subarea = match ($legacy) {
                'superficie' => 'superficie',
                'laminada', 'laminacion' => 'laminacion',
                'prueba lam.', 'prueba laminacion' => 'prueba_laminacion',
                default => 'superficie',
            };
            TintaSubarea::query()->updateOrCreate(
                ['material_id' => $material->getKey()],
                ['subarea' => $subarea]
            );
            $out[] = $material;
        }

        return $out;
    }

    /**
     * Fila 1: solo las primeras N tintas del catálogo (p. ej. 12) para probar el filtro por `product_id`.
     * El resto de productos: sin filas en `product_ink_material` → la API ofrece todo el catálogo.
     */
    private function seedProductInkMaterialForDemo(array $products, array $tintaCatalog): void
    {
        if (count($products) === 0 || count($tintaCatalog) === 0) {
            return;
        }
        $first = $products[0];
        $subset = array_slice($tintaCatalog, 0, min(12, count($tintaCatalog)));
        $now = now();
        foreach ($subset as $m) {
            DB::table('product_ink_material')->updateOrInsert(
                ['product_id' => $first->getKey(), 'material_id' => $m->getKey()],
                ['created_at' => $now, 'updated_at' => $now]
            );
        }
    }

    /**
     * @param  array<int, Supplier>  $suppliers
     * @param  array<int, Material>  $materials
     * @return list<PurchaseOrder|PurchaseReceipt>
     */
    private function seedPurchaseOrdersAndReceipts(array $suppliers, array $materials, User $inventoryUser): array
    {
        $matsMat = collect($materials)->where('inventory_area', InventoryArea::Material->value)->values();
        $m0 = $matsMat->get(0) ?? $materials[0];
        $m1 = $matsMat->get(1) ?? $materials[1];
        $tinta = collect($materials)->first(fn (Material $m) => $m->inventory_area === InventoryArea::Tintas->value);
        $quim = collect($materials)->first(fn (Material $m) => $m->inventory_area === InventoryArea::Quimicos->value);
        if (! $tinta || ! $quim) {
            throw new \RuntimeException('Materiales de tinta/químico requeridos para la demo.');
        }

        $po1 = PurchaseOrder::query()->create([
            'supplier_id' => $suppliers[0]->getKey(),
            'code' => 'OC-DEMO-00001',
            'status' => PurchaseOrderStatus::Open->value,
            'ordered_at' => now()->subDays(4),
            'notes' => 'OC demo',
        ]);
        $line1 = PurchaseOrderLine::query()->create([
            'purchase_order_id' => $po1->getKey(),
            'description' => 'Material PEBD',
            'material_id' => $m0->getKey(),
            'quantity_ordered' => '500.000',
            'quantity_received' => '0.000',
            'unit' => 'kg',
            'unit_price' => '0.0000',
        ]);
        $line2 = PurchaseOrderLine::query()->create([
            'purchase_order_id' => $po1->getKey(),
            'description' => 'BOPP',
            'material_id' => $m1->getKey(),
            'quantity_ordered' => '300.000',
            'quantity_received' => '0.000',
            'unit' => 'kg',
            'unit_price' => '0.0000',
        ]);

        $receipt = $this->purchaseReceipts->store([
            'purchase_order_id' => $po1->getKey(),
            'supplier_id' => (int) $po1->supplier_id,
            'without_purchase_order' => false,
            'notes' => 'Recepción demo',
            'received_at' => now()->subDays(3)->toDateTimeString(),
            'lines' => [
                [
                    'purchase_order_line_id' => $line1->getKey(),
                    'material_id' => $m0->getKey(),
                    'quantity' => '200.000',
                    'bobina_count' => 4,
                ],
                [
                    'purchase_order_line_id' => $line2->getKey(),
                    'material_id' => $m1->getKey(),
                    'quantity' => '150.000',
                    'bobina_count' => 3,
                ],
            ],
        ], $inventoryUser);

        $po2 = PurchaseOrder::query()->create([
            'supplier_id' => $suppliers[0]->getKey(),
            'code' => 'OC-DEMO-00002',
            'status' => PurchaseOrderStatus::Open->value,
            'ordered_at' => now()->subDays(3),
            'notes' => 'OC demo recepción tinta/químico',
        ]);
        $polTinta = PurchaseOrderLine::query()->create([
            'purchase_order_id' => $po2->getKey(),
            'description' => 'Tinta demo',
            'material_id' => $tinta->getKey(),
            'quantity_ordered' => '10.000',
            'quantity_received' => '0.000',
            'unit' => 'kg',
            'unit_price' => '0.0000',
        ]);
        $polQuim = PurchaseOrderLine::query()->create([
            'purchase_order_id' => $po2->getKey(),
            'description' => 'Químico demo',
            'material_id' => $quim->getKey(),
            'quantity_ordered' => '5.000',
            'quantity_received' => '0.000',
            'unit' => 'kg',
            'unit_price' => '0.0000',
        ]);

        $receipt2 = $this->purchaseReceipts->store([
            'purchase_order_id' => $po2->getKey(),
            'supplier_id' => $suppliers[0]->getKey(),
            'without_purchase_order' => false,
            'purchase_order_reference' => $po2->code,
            'notes' => 'Recepción demo ligada a OC',
            'received_at' => now()->subDays(2)->toDateTimeString(),
            'lines' => [
                [
                    'purchase_order_line_id' => $polTinta->getKey(),
                    'material_id' => $tinta->getKey(),
                    'quantity' => '10.000',
                ],
                [
                    'purchase_order_line_id' => $polQuim->getKey(),
                    'material_id' => $quim->getKey(),
                    'quantity' => '5.000',
                ],
            ],
        ], $inventoryUser);

        $out = [$po1->fresh(), $po2->fresh(), $receipt->fresh(), $receipt2->fresh()];
        $ns = count($suppliers);
        $nm = count($materials);

        // $i=2 ya está ocupado por $po2 (OC-DEMO-00002); el volumen continúa desde 00003.
        for ($i = 3; $i <= $this->demoVolume; $i++) {
            $po = PurchaseOrder::query()->create([
                'supplier_id' => $suppliers[($i - 1) % $ns]->getKey(),
                'code' => 'OC-DEMO-'.str_pad((string) $i, 5, '0', STR_PAD_LEFT),
                'status' => PurchaseOrderStatus::Open->value,
                'ordered_at' => now()->subDays(5),
                'notes' => 'OC volumen demo',
            ]);
            PurchaseOrderLine::query()->create([
                'purchase_order_id' => $po->getKey(),
                'description' => 'Línea OC demo '.$i,
                'material_id' => $materials[($i - 1) % $nm]->getKey(),
                'quantity_ordered' => '100.000',
                'quantity_received' => '0.000',
                'unit' => 'kg',
                'unit_price' => '0.0000',
            ]);
            $out[] = $po->fresh();
        }

        return $out;
    }

    /**
     * @param  array<int, Material>  $materials
     */
    private function seedMiscReceipts(array $materials, User $inventoryUser): void
    {
        $dir = 'demo_files';
        Storage::disk('local')->put($dir.'/factura-demo.txt', 'Factura demo Axones');
        $path = Storage::disk('local')->path($dir.'/factura-demo.txt');
        $nm = count($materials);

        for ($i = 1; $i <= $this->demoVolume; $i++) {
            $receipt = MiscellaneousReceipt::query()->create([
                'material_id' => $materials[($i - 1) % $nm]->getKey(),
                'quantity' => '10.000',
                'user_id' => $inventoryUser->getKey(),
                'invoice_reference' => 'FAC-DEMO-'.str_pad((string) $i, 5, '0', STR_PAD_LEFT),
                'notes' => 'Ingreso misceláneo demo '.$i,
                'received_at' => now()->subDays($i % 14),
            ]);

            $rel = 'miscellaneous_receipts/'.$receipt->getKey().'/adjunto-'.$i.'.txt';
            if ($i === 1) {
                $stored = Storage::disk('local')->putFileAs(
                    'miscellaneous_receipts/'.$receipt->getKey(),
                    new File($path),
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
            } else {
                Storage::disk('local')->put($rel, 'Comprobante demo Axones #'.$i);
                MiscellaneousReceiptAttachment::query()->create([
                    'miscellaneous_receipt_id' => $receipt->getKey(),
                    'disk' => 'local',
                    'path' => $rel,
                    'original_name' => 'adjunto-'.$i.'.txt',
                    'mime_type' => 'text/plain',
                    'size_bytes' => Storage::disk('local')->size($rel),
                ]);
            }

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
    }

    private function seedGateMovements(User $boss): void
    {
        for ($i = 1; $i <= $this->demoVolume; $i++) {
            GateMovement::query()->create([
                'direction' => $i % 2 === 1 ? 'in' : 'out',
                'notes' => 'Movimiento caseta demo '.$i.' — '.($i % 2 === 1 ? 'entrada' : 'salida'),
                'photo_path' => null,
                'user_id' => $boss->getKey(),
                'occurred_at' => now()->subHours($i + 1),
            ]);
        }
    }

    /**
     * @param  array<int, Client>  $clients
     * @param  array<int, Product>  $products
     * @param  array<int, Material>  $materials
     * @return array<int, ClientOrder>
     */
    private function seedClientOrders(array $clients, array $products, array $materials): array
    {
        $nc = count($clients);
        $np = count($products);
        $nm = count($materials);
        $out = [];

        for ($i = 1; $i <= $this->demoVolume; $i++) {
            $co = ClientOrder::query()->create([
                'client_id' => $clients[($i - 1) % $nc]->getKey(),
                'code' => 'PC-DEMO-'.str_pad((string) $i, 5, '0', STR_PAD_LEFT),
                'status' => 'open',
                'notes' => 'Pedido cliente demo '.$i,
            ]);

            ClientOrderLine::query()->create([
                'client_order_id' => $co->getKey(),
                'product_id' => $products[($i - 1) % $np]->getKey(),
                'material_id' => $materials[($i - 1) % $nm]->getKey(),
                'quantity' => (string) (100 + $i).'.000',
                'unit' => 'kg',
                'notes' => 'Línea pedido demo '.$i,
            ]);

            $out[] = $co->fresh();
        }

        return $out;
    }

    /**
     * @param  array<int, Material>  $materials
     * @return array<int, Bobina>
     */
    private function seedBobinas(array $materials): array
    {
        $matsMat = collect($materials)->where('inventory_area', InventoryArea::Material->value)->values();
        if ($matsMat->isEmpty()) {
            return [];
        }

        $out = [];
        for ($i = 1; $i <= $this->demoVolume; $i++) {
            $mat = $matsMat[($i - 1) % $matsMat->count()];
            $out[] = Bobina::query()->create([
                'material_id' => $mat->getKey(),
                'code' => 'BOB-BULK-'.str_pad((string) $i, 5, '0', STR_PAD_LEFT),
                'weight_kg' => (string) (90 + $i).'.000',
                'status' => 'available',
            ]);
        }

        return $out;
    }

    /**
     * @param  array<int, ClientOrder>  $clientOrders
     * @param  array<int, Client>  $clients
     * @param  array<int, Product>  $products
     * @param  array<int, Material>  $materials
     * @return array<int, WorkOrder>
     */
    private function seedWorkOrders(array $clientOrders, array $clients, array $products, array $materials, User $printingUser): array
    {
        $nco = count($clientOrders);
        $nc = count($clients);
        $np = count($products);
        $nm = count($materials);
        $matLine = collect($materials)->first(fn (Material $m) => $m->inventory_area === InventoryArea::Material->value)
            ?? $materials[0];

        $stages = [
            WorkOrderBoardStage::Nueva,
            WorkOrderBoardStage::Impresion,
            WorkOrderBoardStage::Laminacion,
            WorkOrderBoardStage::Corte,
            WorkOrderBoardStage::Montaje,
        ];

        $out = [];
        for ($i = 1; $i <= $this->demoVolume; $i++) {
            $co = $clientOrders[($i - 1) % $nco];
            $stage = $i <= 5 ? $stages[$i - 1] : WorkOrderBoardStage::Impresion;
            $sched = $stage === WorkOrderBoardStage::Nueva
                ? WorkOrderSchedulingStatus::PendingProgramming
                : WorkOrderSchedulingStatus::InProgramming;
            $status = $stage === WorkOrderBoardStage::Nueva
                ? WorkOrderStatus::Open
                : WorkOrderStatus::InProgress;

            $wo = WorkOrder::query()->create([
                'code' => WorkOrder::nextCode(),
                'client_order_reference' => $co->code,
                'client_order_id' => $co->getKey(),
                'client_id' => $clients[($i - 1) % $nc]->getKey(),
                'product_id' => $products[($i - 1) % $np]->getKey(),
                'status' => $status->value,
                'scheduling_status' => $sched->value,
                'board_stage' => $stage->value,
                'notes' => 'OT demo volumen '.$i,
                'created_by' => $printingUser->getKey(),
                'document_number' => WorkOrder::nextDocumentNumber(),
                'document_date' => now()->toDateString(),
            ]);

            WorkOrderLine::query()->create([
                'work_order_id' => $wo->getKey(),
                'material_id' => $matLine->getKey(),
                'quantity' => (string) (50 + $i).'.000',
                'notes' => 'Consumo estimado demo',
            ]);

            WorkOrderProductionItem::query()->create([
                'work_order_id' => $wo->getKey(),
                'position' => 0,
                'quantity' => (string) (200 + $i).'.000',
                'quantity_unit' => 'Kg',
                'product_description' => 'Ítem producción demo '.$i,
                'technical_specs' => 'Flexografía · demo',
            ]);

            // Precarga de planificación + impresión para pruebas del módulo (evita formularios vacíos).
            WorkOrderTechnicalDocument::query()->updateOrCreate(
                ['work_order_id' => $wo->getKey()],
                [
                    'form' => [
                        'fechaOrden' => now()->toDateString(),
                        'numeroOrden' => $wo->document_number ?: $wo->code,
                        'pedidoKg' => number_format((float) (100 + $i), 3, '.', ''),
                        'maquina' => $i % 2 === 0 ? 'COMEXI 2' : 'COMEXI 1',
                        'planchasReferencia' => str_pad((string) (($i % 90) + 10), 3, '0', STR_PAD_LEFT),
                        'frecuencia' => '250±2',
                        'anchoCorteMontaje' => '330±2',
                        'numBandas' => (string) max(1, ($i % 4) + 1),
                        'numRepeticion' => (string) (($i % 6) + 1),
                        'desarrollo' => (string) (450 + $i),
                        'anchoMontaje' => (string) (300 + $i),
                        'figuraEmbobinadoMontaje' => (string) (($i % 8) + 1),
                        'obsMontaje' => 'Precarga planificación demo '.$i,
                        'pinonImp' => (string) (820 + $i),
                        'lineaCorte' => 'LC-'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                        'figEmbImpDisplay' => (string) (($i % 8) + 1),
                        'sustratosVirgenImp' => [
                            ['material_id' => (string) $matLine->getKey(), 'kg' => (string) (20 + $i)],
                        ],
                        'kgIngresadoImp' => (string) (22 + $i),
                        'kgSalidaImp' => (string) (20 + $i),
                        'mermaImp' => (string) (2),
                        'metrosImp' => (string) (900 + $i * 10),
                        'tintaColor1' => 'AMARILLO · BF-1564',
                        'tintaAnilox1' => '3.00',
                        'tintaVisc1' => '18',
                        'tintaObs1' => 'Precarga demo',
                        'impTurno' => $i % 2 === 0 ? 'diurno' : 'nocturno',
                        'impGrupo' => ['A', 'B', 'C'][$i % 3],
                        'impOperador' => 'Operador demo '.$i,
                        'impAyudante' => 'Ayudante demo '.$i,
                        'impSupervisor' => 'Supervisor demo '.$i,
                        'impTimerState' => 'stopped',
                        'impTimerEffectiveAccSec' => 1200 + ($i * 10),
                        'impTimerDeadAccSec' => 120,
                        'impEntradaBobinasKg' => array_fill(0, 26, ''),
                        'impSalidaBobinasKg' => array_fill(0, 22, ''),
                        'impDevolucionBuenaKg' => '0',
                        'impDevolucionRechazadaKg' => '0',
                        'impScrapTransparenteKg' => '0.5',
                        'impScrapImpresoKg' => '0.2',
                    ],
                ],
            );

            $out[] = $wo->fresh();
        }

        return $out;
    }

    /**
     * @param  array<int, WorkOrder>  $workOrders
     * @param  array<int, Material>  $materials
     */
    private function seedRequestsAndDispatch(array $workOrders, array $materials, User $inventoryUser): void
    {
        $woIdx = count($workOrders) > 1 ? 1 : 0;
        $wo = $workOrders[$woIdx];
        $mat0 = collect($materials)->first(fn (Material $m) => $m->inventory_area === InventoryArea::Material->value)
            ?? $materials[0];
        $tinta = collect($materials)->first(fn (Material $m) => $m->inventory_area === InventoryArea::Tintas->value);
        if (! $tinta) {
            return;
        }

        $mr = $this->materialRequests->storePendingRequest(
            $wo->fresh(),
            $inventoryUser,
            [
                ['material_id' => $mat0->getKey(), 'quantity_requested' => '20.000'],
                ['material_id' => $tinta->getKey(), 'quantity_requested' => '2.000'],
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

    /**
     * @param  array<int, WorkOrder>  $workOrders
     */
    private function seedQuality(array $workOrders, User $boss): void
    {
        $woIdx = count($workOrders) > 1 ? 1 : 0;
        WorkOrderQualityRecord::query()->updateOrCreate(
            ['work_order_id' => $workOrders[$woIdx]->getKey()],
            [
                'outcome' => 'approved',
                'notes' => 'Calidad demo',
                'recorded_by' => $boss->getKey(),
            ],
        );
    }

    /**
     * @param  array<int, WorkOrder>  $workOrders
     * @param  array<int, Material>  $materials
     */
    private function seedReturnsAndRejectedBobinas(array $workOrders, array $materials): void
    {
        $rejectedMat = collect($materials)->first(
            fn (Material $m) => $m->inventory_area === InventoryArea::BobinasRechazadas->value
        );
        if (! $rejectedMat) {
            return;
        }

        $nw = count($workOrders);
        for ($i = 1; $i <= $this->demoVolume; $i++) {
            InventoryReturn::query()->create([
                'material_id' => $rejectedMat->getKey(),
                'work_order_id' => $workOrders[($i - 1) % $nw]->getKey(),
                'destination_area' => InventoryArea::BobinasRechazadas->value,
                'quantity' => (string) (2 + ($i % 8)).'.000',
                'status' => $i % 3 === 0 ? 'accepted' : 'pending',
                'reason' => 'Devolución inventario demo '.$i,
            ]);
        }
    }

    private function seedAlerts(User $boss): void
    {
        $types = ['mount_time_exceeded', 'low_stock', 'dispatch_delay', 'quality_hold', 'machine_idle'];
        $sev = ['info', 'warning', 'critical'];

        for ($i = 1; $i <= $this->demoVolume; $i++) {
            OperationalAlert::query()->create([
                'alert_type' => $types[($i - 1) % count($types)],
                'severity' => $sev[($i - 1) % count($sev)],
                'message' => 'Alerta operativa demo '.$i.' — datos de prueba.',
                'metadata' => ['tag' => 'demo', 'idx' => $i],
                'created_by' => $boss->getKey(),
            ]);
        }
    }

    /**
     * @param  array<int, WorkOrder>  $workOrders
     * @param  array<int, Material>  $materials
     * @param  array<int, Bobina>  $bobinas
     */
    private function seedHeavyDemoGraph(
        array $workOrders,
        array $materials,
        array $bobinas,
        User $printingUser,
        User $boss,
    ): void {
        $tintas = collect($materials)->where('inventory_area', InventoryArea::Tintas->value)->values();
        $matLine = collect($materials)->first(fn (Material $m) => $m->inventory_area === InventoryArea::Material->value)
            ?? $materials[0];
        $nb = count($bobinas);

        foreach ($workOrders as $idx => $wo) {
            $wid = (int) $wo->getKey();
            $existingDoc = WorkOrderTechnicalDocument::query()->where('work_order_id', $wid)->first();
            $existingForm = is_array($existingDoc?->form) ? $existingDoc->form : [];
            WorkOrderTechnicalDocument::query()->updateOrCreate(
                ['work_order_id' => $wid],
                ['form' => array_merge($existingForm, ['version' => 1, 'demo_index' => $idx + 1])],
            );

            WorkOrderPrintingSummary::query()->firstOrCreate(
                ['work_order_id' => $wid],
                ['scrap_percent' => '1.250', 'notes' => 'Resumen impresión (demo)'],
            );
            WorkOrderCorteSummary::query()->firstOrCreate(
                ['work_order_id' => $wid],
                ['scrap_percent' => '0.800', 'notes' => 'Resumen corte (demo)'],
            );
            WorkOrderLaminacionSummary::query()->firstOrCreate(
                ['work_order_id' => $wid],
                ['scrap_percent' => '1.100', 'solvent_quantity_kg' => '3.000', 'notes' => 'Resumen laminación (demo)'],
            );
            WorkOrderMontajeSummary::query()->firstOrCreate(
                ['work_order_id' => $wid],
                ['scrap_percent' => '0.500', 'notes' => 'Resumen montaje (demo)'],
            );

            $secondWoId = isset($workOrders[1]) ? (int) $workOrders[1]->getKey() : null;
            if ($secondWoId === null || $wid !== $secondWoId) {
                WorkOrderQualityRecord::query()->firstOrCreate(
                    ['work_order_id' => $wid],
                    [
                        'outcome' => 'pending',
                        'notes' => 'Registro calidad pendiente (demo)',
                        'recorded_by' => $boss->getKey(),
                    ],
                );
            }

            $t0 = Carbon::now()->subDays($idx % 10)->subHours($idx + 1);
            PrintingTimeSegment::query()->create([
                'work_order_id' => $wid,
                'machine_code' => 'IMP-'.str_pad((string) (($idx % 4) + 1), 2, '0', STR_PAD_LEFT),
                'segment_type' => 'mount',
                'started_at' => $t0,
                'ended_at' => (clone $t0)->addMinutes(25),
                'user_id' => $printingUser->getKey(),
                'notes' => 'Montaje demo',
            ]);

            $bob = $nb > 0 ? $bobinas[$idx % $nb] : null;
            PrintingBobinaUsage::query()->create([
                'work_order_id' => $wid,
                'bobina_id' => $bob?->getKey(),
                'material_id' => $bob ? (int) $bob->material_id : $matLine->getKey(),
                'quantity_used_kg' => '6.000',
                'quantity_finished_kg' => '5.500',
                'notes' => 'Uso bobina demo',
            ]);

            $chemType = PrintingChemicalType::cases()[$idx % 3];
            PrintingChemicalUsage::query()->updateOrCreate(
                ['work_order_id' => $wid, 'chemical_type' => $chemType->value],
                [
                    'quantity_loaded_kg' => '4.000',
                    'quantity_return_kg' => '0.500',
                    'notes' => 'Consumible demo',
                ],
            );

            $tinMat = $tintas->get($idx % max(1, $tintas->count()));
            if ($tinMat) {
                PrintingInkControlLine::query()->create([
                    'work_order_id' => $wid,
                    'material_id' => $tinMat->getKey(),
                    'position' => $idx % 8,
                    'quantity_original_kg' => '12.000',
                    'quantity_solventada_kg' => '2.500',
                    'quantity_return_kg' => '1.000',
                    'notes' => 'Control tinta demo',
                ]);
            }

            CorteTimeSegment::query()->create([
                'work_order_id' => $wid,
                'machine_code' => 'COR-01',
                'segment_type' => 'production',
                'started_at' => $t0,
                'ended_at' => (clone $t0)->addMinutes(40),
                'user_id' => $printingUser->getKey(),
                'notes' => 'Corte demo',
            ]);
            CorteBobinaUsage::query()->create([
                'work_order_id' => $wid,
                'bobina_id' => $bob?->getKey(),
                'material_id' => $matLine->getKey(),
                'quantity_used_kg' => '7.000',
                'quantity_finished_kg' => '6.800',
                'notes' => 'Corte bobina demo',
            ]);

            LaminacionTimeSegment::query()->create([
                'work_order_id' => $wid,
                'machine_code' => 'LAM-01',
                'segment_type' => 'production',
                'started_at' => $t0,
                'ended_at' => (clone $t0)->addMinutes(35),
                'user_id' => $printingUser->getKey(),
                'notes' => 'Laminación demo',
            ]);
            LaminacionBobinaUsage::query()->create([
                'work_order_id' => $wid,
                'bobina_id' => $bob?->getKey(),
                'material_id' => $matLine->getKey(),
                'quantity_used_kg' => '8.000',
                'quantity_finished_kg' => '7.900',
                'notes' => 'Laminación bobina demo',
            ]);

            MontajeTimeSegment::query()->create([
                'work_order_id' => $wid,
                'machine_code' => 'MON-01',
                'segment_type' => 'production',
                'started_at' => $t0,
                'ended_at' => (clone $t0)->addMinutes(20),
                'user_id' => $printingUser->getKey(),
                'notes' => 'Montaje demo',
            ]);
            MontajeMaterialUsage::query()->create([
                'work_order_id' => $wid,
                'material_id' => $matLine->getKey(),
                'quantity' => '3.000',
                'unit' => 'kg',
                'notes' => 'Material montaje demo',
            ]);

            TintasTimeSegment::query()->create([
                'work_order_id' => $wid,
                'machine_code' => 'TIN-01',
                'segment_type' => 'production',
                'started_at' => $t0,
                'ended_at' => (clone $t0)->addMinutes(28),
                'user_id' => $printingUser->getKey(),
                'notes' => 'Tintas demo',
            ]);
            WorkOrderTintasSummary::query()->firstOrCreate(
                ['work_order_id' => $wid],
                ['scrap_percent' => '0.900', 'notes' => 'Resumen tintas (demo)'],
            );
        }
    }

    /**
     * @param  array<int, WorkOrder>  $workOrders
     * @param  array<int, Material>  $materials
     * @param  array<int, Product>  $products
     * @param  array<int, Supplier>  $suppliers
     */
    private function seedAuxiliaryVolume(
        array $workOrders,
        array $materials,
        array $products,
        array $suppliers,
        User $printingUser,
        User $inventoryUser,
        User $boss,
    ): void {
        $nw = count($workOrders);
        $nm = count($materials);
        $np = count($products);
        $tintas = collect($materials)->where('inventory_area', InventoryArea::Tintas->value)->values();

        $mat0 = collect($materials)->first(fn (Material $m) => $m->inventory_area === InventoryArea::Material->value)
            ?? $materials[0];
        $tinta = collect($materials)->first(fn (Material $m) => $m->inventory_area === InventoryArea::Tintas->value);

        for ($i = 2; $i <= $this->demoVolume; $i++) {
            $targetWo = $workOrders[$i % $nw];
            $this->materialRequests->storePendingRequest(
                $targetWo->fresh(),
                $inventoryUser,
                [
                    ['material_id' => $mat0->getKey(), 'quantity_requested' => (string) (5 + $i).'.000'],
                    $tinta ? ['material_id' => $tinta->getKey(), 'quantity_requested' => '1.000'] : ['description' => 'Repuesto varios', 'quantity_requested' => '1.000'],
                ],
                'printing',
                'Solicitud volumen '.$i,
                now()->toDateString(),
                null,
                'IMP-'.str_pad((string) (($i % 3) + 1), 2, '0', STR_PAD_LEFT),
            );
        }

        $areas = ['printing', 'laminacion', 'corte', 'montaje', 'tintas'];
        for ($i = 1; $i <= $this->demoVolume; $i++) {
            AreaRequest::query()->create([
                'area' => $areas[($i - 1) % count($areas)],
                'title' => 'Solicitud de área demo '.$i,
                'body' => 'Detalle de la solicitud demo '.$i.'.',
                'status' => $i % 4 === 0 ? 'done' : 'pending',
                'work_order_id' => $workOrders[($i - 1) % $nw]->getKey(),
                'requested_by' => $printingUser->getKey(),
            ]);
        }

        for ($i = 1; $i <= $this->demoVolume; $i++) {
            $dn = DeliveryNote::query()->create([
                'sequential_number' => DeliveryNote::nextSequentialNumber(),
                'code' => DeliveryNote::nextCode(),
                'work_order_id' => $workOrders[($i - 1) % $nw]->getKey(),
                'document_date' => now()->toDateString(),
                'driver_name' => 'Conductor demo '.$i,
                'vehicle_notes' => 'Unidad '.$i,
                'status' => $i % 2 === 0 ? 'dispatched' : 'draft',
                'user_id' => $boss->getKey(),
                'dispatched_at' => $i % 2 === 0 ? now()->subHours($i) : null,
                'notes' => 'Nota de entrega demo '.$i,
            ]);

            DeliveryNoteLine::query()->create([
                'delivery_note_id' => $dn->getKey(),
                'work_order_id' => $workOrders[($i - 1) % $nw]->getKey(),
                'product_id' => $products[($i - 1) % $np]->getKey(),
                'description' => 'Línea ND demo '.$i,
                'quantity_kg' => (string) (50 + $i).'.000',
                'pallet_code' => 'PAL-'.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'bobbin_count' => 1 + ($i % 4),
            ]);
        }

        $quim = collect($materials)->first(fn (Material $m) => $m->inventory_area === InventoryArea::Quimicos->value);
        for ($i = 1; $i <= $this->demoVolume; $i++) {
            $outMat = $tintas->get($i % max(1, $tintas->count())) ?? $materials[($i - 1) % $nm];
            $mix = TintaMixture::query()->create([
                'output_material_id' => $outMat->getKey(),
                'notes' => 'Mezcla demo '.$i,
                'created_by' => $printingUser->getKey(),
            ]);
            TintaMixtureComponent::query()->create([
                'tinta_mixture_id' => $mix->getKey(),
                'material_id' => ($quim ?? $mat0)->getKey(),
                'quantity' => (string) (1 + ($i % 5)).'.000',
            ]);
        }

        $supplier = $suppliers[0] ?? null;
        if ($supplier && $nm > 0) {
            while (PurchaseReceipt::query()->count() < $this->demoVolume) {
                $k = PurchaseReceipt::query()->count() + 1;
                $mat = $materials[($k - 1) % $nm];
                $po = PurchaseOrder::query()->create([
                    'supplier_id' => $supplier->getKey(),
                    'code' => 'OC-DEMO-VOL-'.str_pad((string) $k, 5, '0', STR_PAD_LEFT),
                    'status' => PurchaseOrderStatus::Open->value,
                    'ordered_at' => now()->subDays($k % 20),
                    'notes' => 'OC demo volumen recepción',
                ]);
                $pol = PurchaseOrderLine::query()->create([
                    'purchase_order_id' => $po->getKey(),
                    'description' => 'Línea volumen '.$k,
                    'material_id' => $mat->getKey(),
                    'quantity_ordered' => '100.000',
                    'quantity_received' => '0.000',
                    'unit' => 'kg',
                    'unit_price' => '0.0000',
                ]);
                $this->purchaseReceipts->store([
                    'purchase_order_id' => $po->getKey(),
                    'supplier_id' => $supplier->getKey(),
                    'without_purchase_order' => false,
                    'purchase_order_reference' => $po->code,
                    'received_at' => now()->subDays($k % 20)->toDateTimeString(),
                    'notes' => 'Recepción volumen demo',
                    'lines' => [
                        [
                            'purchase_order_line_id' => $pol->getKey(),
                            'material_id' => $mat->getKey(),
                            'quantity' => '15.000',
                        ],
                    ],
                ], $inventoryUser);
            }
        }

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
            'montaje_material_usages',
            'montaje_time_segments',
            'material_request_lines',
            'material_requests',
            'miscellaneous_receipt_attachments',
            'miscellaneous_receipts',
            'operational_alerts',
            'printing_bobina_usages',
            'printing_chemical_usages',
            'printing_ink_control_lines',
            'printing_time_segments',
            'tintas_time_segments',
            'purchase_receipt_lines',
            'purchase_receipts',
            'purchase_order_lines',
            'purchase_orders',
            'materials',
            'tinta_mixture_components',
            'tinta_mixtures',
            'work_order_quality_records',
            'work_order_tintas_summaries',
            'work_order_corte_summaries',
            'work_order_laminacion_summaries',
            'work_order_montaje_summaries',
            'work_order_printing_summaries',
            'work_order_production_items',
            'work_order_lines',
            'work_order_technical_documents',
            'work_orders',
            'product_ink_material',
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
            if (! Schema::hasTable($t)) {
                continue;
            }
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
