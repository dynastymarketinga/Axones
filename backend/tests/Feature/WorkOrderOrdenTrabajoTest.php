<?php

namespace Tests\Feature;

use App\Enums\AreaRequestStatus;
use App\Enums\ClientOrderStatus;
use App\Enums\WorkOrderBoardStage;
use App\Models\AreaRequest;
use App\Models\Client;
use App\Models\ClientOrder;
use App\Models\ClientOrderLine;
use App\Models\OperationalAlert;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkOrderOrdenTrabajoTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_get_orden_trabajo_prefill_from_masters(): void
    {
        $user = User::factory()->create(['role' => 'calidad']);
        $h = $this->auth($user);

        $client = Client::query()->create([
            'name' => 'IANCARINA',
            'rif' => 'J-999',
        ]);

        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'ARROZ MARY PREMIUM',
            'cpe' => '0421496219',
            'mps' => 'A-40.323',
            'print_type' => 'reverso',
            'structure' => 'PEBD 630 X 26 + PEBD 630 X 26',
        ]);

        $co = ClientOrder::query()->create([
            'client_id' => $client->id,
            'code' => ClientOrder::nextCode(),
            'status' => ClientOrderStatus::Open->value,
            'created_by' => $user->id,
        ]);

        ClientOrderLine::query()->create([
            'client_order_id' => $co->id,
            'product_id' => $product->id,
            'quantity' => 10000,
            'unit' => 'Kg',
            'position' => 0,
        ]);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-OT-1',
            'client_id' => $client->id,
            'product_id' => $product->id,
            'client_order_id' => $co->id,
            'document_number' => '065-MAR26',
            'document_date' => '2026-03-18',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $r = $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)->assertOk();
        $this->assertEquals($client->id, $r->json('client_id'));
        $this->assertEquals($product->id, $r->json('product_id'));
        $this->assertEquals('IANCARINA', $r->json('prefill.cliente'));
        $this->assertEquals('J-999', $r->json('prefill.clienteRif'));
        $this->assertEquals('ARROZ MARY PREMIUM', $r->json('prefill.producto'));
        $this->assertEquals('PEBD 630 X 26 + PEBD 630 X 26', $r->json('prefill.estructuraMaterial'));
        $this->assertEquals('0421496219', $r->json('prefill.cpe'));
        $this->assertEquals('A-40.323', $r->json('prefill.mpps'));
        $this->assertNull($r->json('prefill.codigoBarra'));
        $this->assertEquals('Reverso', $r->json('prefill.tipoImpresion'));
        $this->assertEquals('10000.000', $r->json('prefill.pedidoKg'));
        $this->assertEquals('065-MAR26', $r->json('prefill.numeroOrden'));
        $this->assertEquals('2026-03-18', $r->json('prefill.fechaOrden'));
        $this->assertNull($r->json('form'));
    }

    public function test_put_orden_trabajo_persists_form(): void
    {
        $user = User::factory()->create(['role' => 'calidad']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-OT-2',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $payload = ['form' => [
            'cliente' => 'X',
            'pedidoKg' => '100',
            'maquina' => 'COMEXI 1',
            'tipoImpresionEstructura' => 'reverso',
            'tintas' => [['posicion' => 1, 'color' => 'NEGRO']],
        ]];

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", $payload, $h)->assertOk();

        $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)
            ->assertOk()
            ->assertJsonPath('form.cliente', 'X')
            ->assertJsonPath('form.tintas.0.color', 'NEGRO');
    }

    public function test_patch_work_order_rejects_product_from_other_client(): void
    {
        $user = User::factory()->create(['role' => 'calidad']);
        $h = $this->auth($user);

        $c1 = Client::query()->create(['name' => 'A', 'rif' => 'J-1']);
        $c2 = Client::query()->create(['name' => 'B', 'rif' => 'J-2']);
        $p1 = Product::query()->create([
            'client_id' => $c1->id,
            'name' => 'P1',
            'cpe' => 'C1',
            'mps' => 'M1',
            'print_type' => 'Flexografía',
            'structure' => 'S1',
        ]);
        $p2 = Product::query()->create([
            'client_id' => $c2->id,
            'name' => 'P2',
            'cpe' => 'C2',
            'mps' => 'M2',
            'print_type' => 'Flexografía',
            'structure' => 'S2',
        ]);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-OT-3',
            'client_id' => $c1->id,
            'product_id' => $p1->id,
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}", ['product_id' => $p2->id], $h)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('product_id');
    }

    public function test_put_orden_trabajo_rejects_invalid_form_shapes_and_values(): void
    {
        $user = User::factory()->create(['role' => 'calidad']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-OT-4',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $payload = [
            'form' => [
                'pedidoKg' => '0',
                'maquina' => '',
                'tipoImpresionEstructura' => '',
                'frecuencia' => 'abc',
                'numBandas' => 'x',
                'anchoCorteMontaje' => 'hola',
                'numRepeticion' => '0',
                'numColores' => 'z',
                'pinonImp' => 'abc',
                'gramajeAdhesivo' => 'A1',
                'relacionMezcla' => 'abc',
                'anchoCorteFinal' => 'texto',
                'maxEmpates' => '0',
                'cantCores' => 'x',
                'kgIngresadosCorte' => 'xx',
                'sustratosVirgenLam' => [
                    ['kg' => 'bad'],
                    ['kg' => '1'],
                    ['kg' => '2'],
                    ['kg' => '3'],
                    ['kg' => '4'],
                ],
            ],
        ];

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", $payload, $h)
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'form.pedidoKg',
                'form.maquina',
                'form.tipoImpresionEstructura',
                'form.frecuencia',
                'form.numBandas',
                'form.anchoCorteMontaje',
                'form.numRepeticion',
                'form.numColores',
                'form.pinonImp',
                'form.gramajeAdhesivo',
                'form.relacionMezcla',
                'form.anchoCorteFinal',
                'form.maxEmpates',
                'form.cantCores',
                'form.kgIngresadosCorte',
                'form.sustratosVirgenLam',
            ]);
    }

    public function test_put_orden_trabajo_accepts_valid_technical_formats(): void
    {
        $user = User::factory()->create(['role' => 'calidad']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-OT-5',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $payload = [
            'form' => [
                'pedidoKg' => '112.000',
                'maquina' => 'COMEXI 1',
                'tipoImpresionEstructura' => 'reverso',
                'frecuencia' => '250±2',
                'numBandas' => '2',
                'anchoCorteMontaje' => '330±2',
                'numRepeticion' => '2',
                'numColores' => '4',
                'pinonImp' => '108',
                'gramajeAdhesivo' => '1,25',
                'relacionMezcla' => '100/80',
                'anchoCorteFinal' => '320±0',
                'pesoBobina' => '19-20',
                'metrosBobina' => '1020 ± 20',
                'distFotoceldaBorde' => '1±1',
                'distFiguraLadoContrario' => '20±1',
                'distFiguraLadoFotocelda' => '30±1',
                'maxEmpates' => '1',
                'diamBobina' => '400 ± 5',
                'anchoCore' => '460',
                'diamCorePlg' => '3',
                'cantCores' => '10',
                'kgIngresadosCorte' => '100.5',
                'kgSalidaCorte' => '90.0',
                'kgMermaCorte' => '10.5',
                'metrajeCorte' => '1000',
                'sustratosVirgenLam' => [
                    ['material_id' => '1', 'kg' => '10.5'],
                ],
            ],
        ];

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", $payload, $h)->assertOk();
    }

    public function test_put_orden_trabajo_with_notify_on_production_save_creates_handoff_without_forcing_board_stage(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'impresion']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-NOTIFY-1',
            'status' => 'in_progress',
            'board_stage' => WorkOrderBoardStage::Impresion->value,
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => [
                'impOperador' => 'Operador test',
                'impTurno' => '1',
                'impGrupo' => 'A',
                'impMetrajeProduccion' => '100',
            ],
            'origin_area' => 'impresion',
            'notify_on_production_save' => true,
        ], $h)->assertOk();

        $this->assertDatabaseHas('area_requests', [
            'work_order_id' => $wo->id,
            'area' => 'laminacion',
        ]);
        $this->assertDatabaseHas('area_requests', [
            'work_order_id' => $wo->id,
            'area' => 'corte',
        ]);
        $this->assertDatabaseHas('area_requests', [
            'work_order_id' => $wo->id,
            'area' => 'tintas',
        ]);

        $this->assertDatabaseHas('operational_alerts', [
            'work_order_id' => $wo->id,
            'alert_type' => 'production_handoff',
        ]);
        $this->assertDatabaseHas('operational_alerts', [
            'work_order_id' => $wo->id,
            'alert_type' => 'production_saved',
        ]);

        $savedAlert = OperationalAlert::query()
            ->where('work_order_id', $wo->id)
            ->where('alert_type', 'production_saved')
            ->latest('id')
            ->first();
        $this->assertNotNull($savedAlert);
        $this->assertSame('impresion', data_get($savedAlert?->metadata, 'target_area'));

        $this->assertSame(
            WorkOrderBoardStage::Impresion->value,
            $wo->fresh()->board_stage?->value ?? (string) $wo->fresh()->board_stage
        );
    }

    public function test_impresion_cannot_put_full_orden_trabajo(): void
    {
        User::factory()->create(); // Evitar id 1 (omitido por middleware como root técnico).
        $user = User::factory()->create(['role' => 'impresion']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-DENY-PUT',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", [
            'form' => [
                'pedidoKg' => '100',
                'maquina' => 'COMEXI 1',
                'tipoImpresionEstructura' => 'reverso',
            ],
        ], $h)->assertForbidden();
    }

    public function test_impresion_can_get_orden_trabajo_and_patch_printing_control(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'impresion']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-PATCH-CTRL',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)->assertOk();

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => [
                'impOperador' => 'Juan',
                'impTurno' => '2',
                'impGrupo' => 'B',
            ],
        ], $h)->assertOk();

        $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)
            ->assertOk()
            ->assertJsonPath('form.impOperador', 'Juan');
    }

    public function test_printing_control_rejects_non_imp_keys(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'impresion']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-BAD-KEY',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => [
                'pedidoKg' => '50',
            ],
        ], $h)->assertUnprocessable();
    }

    public function test_printing_control_persists_imp_turnos_and_turno_actual_json(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'impresion']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-IMP-JSON',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $turnos = [
            [
                'id' => 't1',
                'started_at' => '2026-05-07T08:00:00.000Z',
                'closed_at' => '2026-05-07T16:00:00.000Z',
                'operador' => 'Ana',
                'timer' => ['effectiveAccSec' => 3600],
            ],
        ];
        $actual = [
            'id' => 't2',
            'started_at' => '2026-05-07T16:01:00.000Z',
            'closed_at' => null,
            'operador' => 'Luis',
            'timer' => ['effectiveAccSec' => 0],
        ];

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => [
                'impTurnosImpresion' => $turnos,
                'impTurnoActual' => $actual,
                'impEstadoArea' => 'abierta',
                'impOperador' => 'Luis',
            ],
        ], $h)->assertOk();

        $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)
            ->assertOk()
            ->assertJsonPath('form.impTurnosImpresion.0.id', 't1')
            ->assertJsonPath('form.impTurnosImpresion.0.operador', 'Ana')
            ->assertJsonPath('form.impTurnoActual.id', 't2')
            ->assertJsonPath('form.impTurnoActual.closed_at', null)
            ->assertJsonPath('form.impEstadoArea', 'abierta');
    }

    public function test_printing_control_rejects_imp_estado_area_finalizada_for_non_boss(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'impresion']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-IMP-DENY-FIN',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => [
                'impEstadoArea' => 'finalizada',
            ],
        ], $h)->assertUnprocessable()
            ->assertJsonValidationErrors(['form.impEstadoArea']);
    }

    public function test_printing_control_allows_imp_estado_area_finalizada_for_boss(): void
    {
        User::factory()->create();
        $boss = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($boss);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-IMP-ALLOW-FIN',
            'status' => 'open',
            'created_by' => $boss->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => [
                'impEstadoArea' => 'finalizada',
            ],
        ], $h)->assertOk();

        $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)
            ->assertOk()
            ->assertJsonPath('form.impEstadoArea', 'finalizada');
    }

    public function test_put_orden_trabajo_broadcasts_saved_to_all_areas(): void
    {
        $user = User::factory()->create(['role' => 'calidad']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-BROADCAST-SAVE',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $payload = ['form' => [
            'cliente' => 'X',
            'pedidoKg' => '100',
            'maquina' => 'COMEXI 1',
            'tipoImpresionEstructura' => 'reverso',
        ]];

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", $payload, $h)->assertOk();

        $this->assertSame(4, OperationalAlert::query()
            ->where('work_order_id', $wo->id)
            ->where('alert_type', 'work_order_saved_broadcast')
            ->count());
        $this->assertDatabaseHas('area_requests', ['work_order_id' => $wo->id, 'area' => 'tintas']);
    }

    public function test_work_orders_mi_area_filters_by_pending_area_request(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-MIAREA-1',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Nueva->value,
            'created_by' => $user->id,
        ]);
        AreaRequest::query()->create([
            'area' => 'tintas',
            'title' => 'Test tintas',
            'body' => 'b',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $wo->id,
            'requested_by' => $user->id,
        ]);

        $r = $this->getJson('/api/work-orders?mi_area=tintas&per_page=20', $h)->assertOk();
        $ids = collect($r->json('data'))->pluck('id')->all();
        $this->assertContains($wo->id, $ids);
    }

    public function test_mi_area_area_process_tag_not_started_filters_before_target_stage(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);

        $woBefore = WorkOrder::query()->create([
            'code' => 'OT-TAG-NS-BEFORE',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Montaje->value,
            'created_by' => $user->id,
        ]);
        AreaRequest::query()->create([
            'area' => 'impresion',
            'title' => 'Imp',
            'body' => 'b',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $woBefore->id,
            'requested_by' => $user->id,
        ]);

        $woAt = WorkOrder::query()->create([
            'code' => 'OT-TAG-NS-AT',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Impresion->value,
            'created_by' => $user->id,
        ]);
        AreaRequest::query()->create([
            'area' => 'impresion',
            'title' => 'Imp',
            'body' => 'b',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $woAt->id,
            'requested_by' => $user->id,
        ]);

        $r = $this->getJson('/api/work-orders?mi_area=impresion&area_process_tag=not_started&per_page=20', $h)->assertOk();
        $ids = collect($r->json('data'))->pluck('id')->all();
        $this->assertContains($woBefore->id, $ids);
        $this->assertNotContains($woAt->id, $ids);
    }

    public function test_mi_area_area_process_tag_in_progress_filters_at_target_stage(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);

        $woBefore = WorkOrder::query()->create([
            'code' => 'OT-TAG-IP-BEFORE',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Montaje->value,
            'created_by' => $user->id,
        ]);
        AreaRequest::query()->create([
            'area' => 'impresion',
            'title' => 'Imp',
            'body' => 'b',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $woBefore->id,
            'requested_by' => $user->id,
        ]);

        $woAt = WorkOrder::query()->create([
            'code' => 'OT-TAG-IP-AT',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Impresion->value,
            'created_by' => $user->id,
        ]);
        AreaRequest::query()->create([
            'area' => 'impresion',
            'title' => 'Imp',
            'body' => 'b',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $woAt->id,
            'requested_by' => $user->id,
        ]);

        $r = $this->getJson('/api/work-orders?mi_area=impresion&area_process_tag=in_progress&per_page=20', $h)->assertOk();
        $ids = collect($r->json('data'))->pluck('id')->all();
        $this->assertNotContains($woBefore->id, $ids);
        $this->assertContains($woAt->id, $ids);
    }

    public function test_historial_area_exclude_pending_omits_pending_area_requests(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);

        $woPending = WorkOrder::query()->create([
            'code' => 'OT-HIST-PEND',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Impresion->value,
            'created_by' => $user->id,
        ]);
        AreaRequest::query()->create([
            'area' => 'tintas',
            'title' => 'T',
            'body' => 'b',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $woPending->id,
            'requested_by' => $user->id,
        ]);

        $woDone = WorkOrder::query()->create([
            'code' => 'OT-HIST-DONE',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Impresion->value,
            'created_by' => $user->id,
        ]);
        AreaRequest::query()->create([
            'area' => 'tintas',
            'title' => 'T',
            'body' => 'b',
            'status' => AreaRequestStatus::Done->value,
            'work_order_id' => $woDone->id,
            'requested_by' => $user->id,
        ]);

        $r = $this->getJson('/api/work-orders?historial_area=tintas&historial_exclude_pending=1&per_page=20', $h)->assertOk();
        $ids = collect($r->json('data'))->pluck('id')->all();
        $this->assertNotContains($woPending->id, $ids);
        $this->assertContains($woDone->id, $ids);
    }
}
