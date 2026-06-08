<?php

namespace Tests\Feature;

use App\Enums\AreaRequestStatus;
use App\Enums\ClientOrderStatus;
use App\Enums\WorkOrderBoardStage;
use App\Models\AreaRequest;
use App\Models\Client;
use App\Models\ClientOrder;
use App\Models\ClientOrderLine;
use App\Enums\DeliveryNoteStatus;
use App\Models\CorteBobinaUsage;
use App\Models\DeliveryNote;
use App\Models\DeliveryNoteLine;
use App\Models\Material;
use App\Models\OperationalAlert;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderLine;
use App\Models\WorkOrderTechnicalDocument;
use App\Services\CortePlanillaDispatchSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkOrderOrdenTrabajoTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer ' . $user->createToken('t')->plainTextToken];
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
            'barcode' => '7590123456789',
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
        $this->assertSame('7590123456789', $r->json('prefill.codigoBarra'));
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

        $lamMat = Material::query()->create([
            'sku' => 'OT-LAM-STOCK',
            'name' => 'Sustrato lam stock test',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $lamMat->forceFill(['quantity_on_hand' => 500])->save();

        $payload = [
            'form' => [
                'pedidoKg' => '112.000',
                'maquina' => 'COMEXI 1',
                'tipoImpresionEstructura' => 'trilaminado',
                'frecuencia' => '250±2',
                'numBandas' => '2',
                'anchoCorteMontaje' => '330±2',
                'numRepeticion' => '2',
                'numColores' => '4',
                'pinonImp' => '108',
                'gramajeAdhesivo' => '1,5 A 2,2',
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
                    ['material_id' => (string) $lamMat->id, 'kg' => '10.5', 'material_free_text' => ''],
                ],
            ],
        ];

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", $payload, $h)->assertOk();
    }

    public function test_put_orden_trabajo_accepts_sustrato_kg_above_stock(): void
    {
        $user = User::factory()->create(['role' => 'calidad']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-OT-STOCK-1',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $mat = Material::query()->create([
            'sku' => 'OT-LOW-STOCK',
            'name' => 'Sustrato poco stock',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 5])->save();

        $payload = [
            'form' => [
                'pedidoKg' => '100',
                'maquina' => 'COMEXI 1',
                'tipoImpresionEstructura' => 'reverso',
                'sustratosVirgenImp' => [
                    ['material_id' => (string) $mat->id, 'kg' => '99.000', 'material_free_text' => ''],
                ],
            ],
        ];

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", $payload, $h)->assertOk();
    }

    public function test_put_orden_trabajo_accepts_sustrato_kg_within_stock(): void
    {
        $user = User::factory()->create(['role' => 'calidad']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-OT-STOCK-2',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $mat = Material::query()->create([
            'sku' => 'OT-OK-STOCK',
            'name' => 'Sustrato stock suficiente',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        $mat->forceFill(['quantity_on_hand' => 100])->save();

        $payload = [
            'form' => [
                'pedidoKg' => '50',
                'maquina' => 'COMEXI 1',
                'tipoImpresionEstructura' => 'superficie',
                'sustratosVirgenImp' => [
                    ['material_id' => (string) $mat->id, 'kg' => '42.5', 'material_free_text' => ''],
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
                'impTimerState' => 'running',
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

        $this->assertSame(
            WorkOrderBoardStage::Impresion->value,
            $wo->fresh()->board_stage?->value ?? (string) $wo->fresh()->board_stage
        );
    }

    public function test_printing_control_strips_merma_and_metraje_on_save(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'impresion']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-STRIP-MERMA',
            'status' => 'in_progress',
            'board_stage' => WorkOrderBoardStage::Impresion->value,
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => [
                'impMermaKg' => '200',
                'impMetrajeProduccion' => '999',
                'impTurnosImpresion' => [[
                    'id' => 'turn-legacy-1',
                    'turno' => 'diurno',
                    'grupo' => 'A',
                    'mermaKg' => '50',
                    'metrajeProduccion' => '100',
                ]],
            ],
        ], $h)->assertOk();

        $form = WorkOrderTechnicalDocument::query()
            ->where('work_order_id', $wo->id)
            ->value('form');
        $this->assertIsArray($form);
        $this->assertArrayNotHasKey('impMermaKg', $form);
        $this->assertArrayNotHasKey('impMetrajeProduccion', $form);
        $turnos = $form['impTurnosImpresion'] ?? [];
        $this->assertIsArray($turnos);
        $this->assertNotEmpty($turnos);
        $this->assertArrayNotHasKey('mermaKg', $turnos[0]);
        $this->assertArrayNotHasKey('metrajeProduccion', $turnos[0]);
    }

    public function test_production_save_with_notify_rejected_without_timer_started(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'impresion']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-GUARD-1',
            'status' => 'in_progress',
            'board_stage' => WorkOrderBoardStage::Impresion->value,
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => [
                'impTurnoActual' => [
                    'id' => 't1',
                    'operador' => 'Op',
                    'turno' => 'diurno',
                    'grupo' => 'A',
                ],
                'impTimerState' => 'pending',
            ],
            'origin_area' => 'impresion',
            'notify_on_production_save' => true,
        ], $h)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['form']);
    }

    public function test_printing_control_close_turn_with_notify_on_production_save_persists_acumulado(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'impresion']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-CLOSE-NOTIFY',
            'status' => 'in_progress',
            'board_stage' => WorkOrderBoardStage::Impresion->value,
            'created_by' => $user->id,
        ]);

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'impEstadoArea' => 'abierta',
                'impTurnoActual' => [
                    'id' => 't-open',
                    'operador' => 'Victor',
                    'turno' => 'nocturno',
                    'grupo' => 'B',
                    'salidaBobinasKg' => ['12000', ...array_fill(0, 29, '')],
                    'timer' => [
                        'state' => 'running',
                        'effectiveAccSec' => 40,
                        'deadAccSec' => 0,
                        'lastResumeAtMs' => 0,
                        'pauseAtMs' => 0,
                        'pauses' => [],
                    ],
                ],
                'impTimerState' => 'running',
                'impTurnosImpresion' => [],
            ],
        ]);

        $closedAt = now()->toIso8601String();
        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => [
                'impTurnoActual' => null,
                'impTurnosImpresion' => [
                    [
                        'id' => 't-open',
                        'operador' => 'Victor',
                        'turno' => 'nocturno',
                        'grupo' => 'B',
                        'closed_at' => $closedAt,
                        'salidaBobinasKg' => ['12000', ...array_fill(0, 29, '')],
                        'timer' => [
                            'state' => 'stopped',
                            'effectiveAccSec' => 40,
                            'deadAccSec' => 0,
                        ],
                        'resumenCierre' => [
                            'pesoSalidaKg' => 12000,
                            'pesoEntradaKg' => 12000,
                            'scrapKg' => 24,
                        ],
                    ],
                ],
                'impAcumuladoProducidoKg' => '12000',
                'impTimerState' => 'completed',
                'impTimerEffectiveAccSec' => '40',
            ],
            'origin_area' => 'impresion',
            'notify_on_production_save' => true,
        ], $h)->assertOk();

        $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)
            ->assertOk()
            ->assertJsonPath('form.impTurnoActual', null)
            ->assertJsonPath('form.impAcumuladoProducidoKg', '12000')
            ->assertJsonPath('form.impTurnosImpresion.0.resumenCierre.pesoSalidaKg', 12000);
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

    public function test_printing_control_allows_imp_estado_area_finalizada_for_jefe_operaciones(): void
    {
        User::factory()->create();
        $jefe = User::factory()->create(['role' => 'jefe_operaciones']);
        $h = $this->auth($jefe);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-IMP-JEFE-FIN',
            'status' => 'open',
            'created_by' => $jefe->id,
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

    public function test_printing_control_finalize_without_active_turno_when_notify_production_save_false(): void
    {
        User::factory()->create();
        $boss = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($boss);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-IMP-FIN-NO-TURNO',
            'status' => 'open',
            'created_by' => $boss->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => [
                'impTurnoActual' => null,
                'impTurnosImpresion' => [
                    [
                        'id' => 't1',
                        'operador' => 'Ana',
                        'turno' => 'diurno',
                        'grupo' => 'A',
                        'closed_at' => now()->toIso8601String(),
                        'timer' => ['state' => 'stopped', 'effectiveAccSec' => 120, 'deadAccSec' => 5],
                    ],
                ],
                'impEstadoArea' => 'finalizada',
                'impOperador' => '',
                'impTurno' => '',
                'impGrupo' => '',
                'impTimerState' => 'completed',
            ],
            'origin_area' => 'impresion',
            'notify_on_production_save' => false,
        ], $h)->assertOk();

        $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)
            ->assertOk()
            ->assertJsonPath('form.impEstadoArea', 'finalizada')
            ->assertJsonPath('form.impTurnoActual', null);
    }

    public function test_laminacion_control_rejects_lam_estado_area_finalizada_for_non_boss(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'laminacion']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-LAM-DENY-FIN',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/laminacion-control", [
            'form' => [
                'lamEstadoArea' => 'finalizada',
            ],
        ], $h)->assertUnprocessable()
            ->assertJsonValidationErrors(['form.lamEstadoArea']);
    }

    public function test_laminacion_control_allows_lam_estado_area_finalizada_for_boss(): void
    {
        User::factory()->create();
        $boss = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($boss);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-LAM-ALLOW-FIN',
            'status' => 'open',
            'created_by' => $boss->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/laminacion-control", [
            'form' => [
                'lamEstadoArea' => 'finalizada',
            ],
        ], $h)->assertOk();

        $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)
            ->assertOk()
            ->assertJsonPath('form.lamEstadoArea', 'finalizada');
    }

    public function test_laminacion_control_finalize_without_active_turno_when_notify_production_save_false(): void
    {
        User::factory()->create();
        $boss = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($boss);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-LAM-FIN-NO-TURNO',
            'status' => 'open',
            'created_by' => $boss->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/laminacion-control", [
            'form' => [
                'lamTurnoActual' => null,
                'lamTurnosLaminacion' => [
                    [
                        'id' => 't1',
                        'operador' => 'Ana',
                        'turno' => 'diurno',
                        'grupo' => 'A',
                        'closed_at' => now()->toIso8601String(),
                        'timer' => ['state' => 'stopped', 'effectiveAccSec' => 90, 'deadAccSec' => 0],
                    ],
                ],
                'lamEstadoArea' => 'finalizada',
                'lamOperador' => '',
                'lamTurno' => '',
                'lamGrupo' => '',
                'lamTimerState' => 'completed',
            ],
            'origin_area' => 'laminacion',
            'notify_on_production_save' => false,
        ], $h)->assertOk();

        $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)
            ->assertOk()
            ->assertJsonPath('form.lamEstadoArea', 'finalizada')
            ->assertJsonPath('form.lamTurnoActual', null);
    }

    public function test_corte_can_get_orden_trabajo_and_patch_corte_control(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'corte']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-CORTE-PATCH',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)->assertOk();

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'corOperador' => 'Pedro',
                'corTurno' => 'diurno',
                'corGrupo' => 'A',
            ],
        ], $h)->assertOk();

        $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)
            ->assertOk()
            ->assertJsonPath('form.corOperador', 'Pedro');
    }

    public function test_corte_control_rejects_non_corte_keys(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'corte']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-CORTE-BAD-KEY',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'pedidoKg' => '50',
            ],
        ], $h)->assertUnprocessable();
    }

    public function test_corte_control_persists_turnos_and_paletas_json(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'corte']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-CORTE-JSON',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $paletas = [
            [
                'id' => 'p-01',
                'label' => 'Paleta #01',
                'rollosKg' => array_fill(0, 48, '12.5'),
                'status' => 'en_progreso',
            ],
        ];
        $actual = [
            'id' => 't2',
            'started_at' => '2026-05-07T16:01:00.000Z',
            'closed_at' => null,
            'operador' => 'Luis',
            'turno' => 'diurno',
            'grupo' => 'A',
            'paletas' => $paletas,
            'timer' => ['state' => 'running', 'effectiveAccSec' => 120],
        ];

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'cor_turnos' => [],
                'corTurnoActual' => $actual,
                'cor_paletas' => $paletas,
                'kgSalidaCorte' => '600.00',
            ],
        ], $h)->assertOk();

        $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)
            ->assertOk()
            ->assertJsonPath('form.corTurnoActual.id', 't2')
            ->assertJsonPath('form.cor_paletas.0.label', 'Paleta #01')
            ->assertJsonPath('form.kgSalidaCorte', '600.00');
    }

    public function test_corte_production_save_with_notify_rejected_without_timer_started(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'corte']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-CORTE-GUARD',
            'status' => 'in_progress',
            'board_stage' => WorkOrderBoardStage::Corte->value,
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'corTurnoActual' => [
                    'id' => 't1',
                    'operador' => 'Op',
                    'turno' => 'diurno',
                    'grupo' => 'A',
                ],
                'corTimerState' => 'pending',
            ],
            'origin_area' => 'corte',
            'notify_on_production_save' => true,
        ], $h)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['form']);
    }

    public function test_corte_control_rejects_cor_estado_area_finalizada_for_non_boss(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'corte']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-CORTE-DENY-FIN',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'corEstadoArea' => 'finalizada',
            ],
        ], $h)->assertUnprocessable()
            ->assertJsonValidationErrors(['form.corEstadoArea']);
    }

    public function test_corte_control_allows_cor_estado_area_finalizada_for_boss(): void
    {
        User::factory()->create();
        $boss = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($boss);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-CORTE-ALLOW-FIN',
            'status' => 'open',
            'created_by' => $boss->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'corEstadoArea' => 'finalizada',
            ],
        ], $h)->assertOk();

        $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)
            ->assertOk()
            ->assertJsonPath('form.corEstadoArea', 'finalizada');
    }

    public function test_corte_control_finalize_without_active_turno_when_notify_production_save_false(): void
    {
        User::factory()->create();
        $boss = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($boss);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-CORTE-FIN-NO-TURNO',
            'status' => 'open',
            'created_by' => $boss->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'corTurnoActual' => null,
                'cor_turnos' => [
                    [
                        'id' => 't1',
                        'operador' => 'Ana',
                        'turno' => 'diurno',
                        'grupo' => 'A',
                        'closed_at' => now()->toIso8601String(),
                        'timer' => ['state' => 'stopped', 'effectiveAccSec' => 90, 'deadAccSec' => 0],
                    ],
                ],
                'corEstadoArea' => 'finalizada',
                'corOperador' => '',
                'corTurno' => '',
                'corGrupo' => '',
                'corTimerState' => 'completed',
            ],
            'origin_area' => 'corte',
            'notify_on_production_save' => false,
        ], $h)->assertOk();

        $this->getJson("/api/work-orders/{$wo->id}/orden-trabajo", $h)
            ->assertOk()
            ->assertJsonPath('form.corEstadoArea', 'finalizada')
            ->assertJsonPath('form.corTurnoActual', null);
    }

    public function test_corte_control_patch_syncs_finished_kg_to_dispatch(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'corte']);
        $h = $this->auth($user);

        $client = Client::query()->create([
            'name' => 'C-SYNC',
            'rif' => 'J-' . random_int(10000000, 99999999),
        ]);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'P-SYNC',
            'cpe' => 'CPE-SYNC',
        ]);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-CORTE-SYNC-' . uniqid(),
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => 'open',
            'created_by' => $user->id,
        ]);
        $mat = Material::query()->create([
            'sku' => 'M-SYNC-' . uniqid(),
            'name' => 'Mat',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        WorkOrderLine::query()->create([
            'work_order_id' => $wo->id,
            'material_id' => $mat->id,
            'quantity' => 1,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'kgSalidaCorte' => '12.00',
            ],
        ], $h)->assertOk();

        $this->assertDatabaseHas('corte_bobina_usages', [
            'work_order_id' => $wo->id,
            'quantity_finished_kg' => '12.000',
            'notes' => CortePlanillaDispatchSyncService::PLANILLA_NOTES,
        ]);

        $rows = $this->getJson('/api/corte-dispatch/available', $h)->assertOk()->json('rows');
        $match = collect($rows)->firstWhere('work_order_id', $wo->id);
        $this->assertNotNull($match);
        $this->assertEquals('12.000', $match['quantity_remaining_kg']);
    }

    public function test_corte_control_patch_rejects_finished_kg_below_dispatched(): void
    {
        User::factory()->create();
        $user = User::factory()->create(['role' => 'corte']);
        $h = $this->auth($user);

        $client = Client::query()->create([
            'name' => 'C-BLOCK',
            'rif' => 'J-' . random_int(10000000, 99999999),
        ]);
        $product = Product::query()->create([
            'client_id' => $client->id,
            'name' => 'P-BLOCK',
            'cpe' => 'CPE-BLOCK',
        ]);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-CORTE-BLOCK-' . uniqid(),
            'client_id' => $client->id,
            'product_id' => $product->id,
            'status' => 'open',
            'created_by' => $user->id,
        ]);
        $mat = Material::query()->create([
            'sku' => 'M-BLOCK-' . uniqid(),
            'name' => 'Mat',
            'inventory_area' => 'material',
            'unit' => 'kg',
            'min_stock' => 0,
        ]);
        WorkOrderLine::query()->create([
            'work_order_id' => $wo->id,
            'material_id' => $mat->id,
            'quantity' => 1,
        ]);

        $usage = CorteBobinaUsage::query()->create([
            'work_order_id' => $wo->id,
            'material_id' => $mat->id,
            'quantity_used_kg' => 0,
            'quantity_finished_kg' => '20.000',
            'notes' => CortePlanillaDispatchSyncService::PLANILLA_NOTES,
        ]);

        $dn = DeliveryNote::query()->create([
            'code' => 'ND-BLOCK',
            'status' => DeliveryNoteStatus::Draft->value,
            'user_id' => $user->id,
        ]);
        DeliveryNoteLine::query()->create([
            'delivery_note_id' => $dn->id,
            'corte_bobina_usage_id' => $usage->id,
            'work_order_id' => $wo->id,
            'quantity_kg' => 10,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'kgSalidaCorte' => '5.00',
            ],
        ], $h)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['form.kgSalidaCorte']);
    }

    public function test_put_orden_trabajo_without_assignment_creates_no_area_requests(): void
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

        $this->assertSame(0, OperationalAlert::query()
            ->where('work_order_id', $wo->id)
            ->where('alert_type', 'work_order_saved_broadcast')
            ->count());
        $this->assertSame(0, AreaRequest::query()->where('work_order_id', $wo->id)->count());
    }

    public function test_put_orden_trabajo_assignment_creates_only_assigned_areas(): void
    {
        $user = User::factory()->create(['role' => 'calidad']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-ASSIGN-ONLY',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        $payload = [
            'form' => [
                'cliente' => 'X',
                'pedidoKg' => '100',
                'maquina' => 'COMEXI 1',
                'tipoImpresionEstructura' => 'reverso',
            ],
            'assigned_areas' => ['impresion', 'tintas'],
            'assignment_reason' => 'Solo impresión y tintas',
        ];

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", $payload, $h)->assertOk();

        $this->assertSame(2, AreaRequest::query()->where('work_order_id', $wo->id)->count());
        $this->assertDatabaseHas('area_requests', ['work_order_id' => $wo->id, 'area' => 'impresion', 'status' => 'pending']);
        $this->assertDatabaseHas('area_requests', ['work_order_id' => $wo->id, 'area' => 'tintas', 'status' => 'pending']);
        $this->assertDatabaseMissing('area_requests', ['work_order_id' => $wo->id, 'area' => 'montaje']);
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

    public function test_work_orders_mi_area_montaje_filters_by_pending_area_request(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-MIAREA-MONT',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Montaje->value,
            'created_by' => $user->id,
        ]);
        AreaRequest::query()->create([
            'area' => 'montaje',
            'title' => 'Test montaje',
            'body' => 'b',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $wo->id,
            'requested_by' => $user->id,
        ]);

        $r = $this->getJson('/api/work-orders?mi_area=montaje&per_page=20', $h)->assertOk();
        $ids = collect($r->json('data'))->pluck('id')->all();
        $this->assertContains($wo->id, $ids);
    }

    public function test_mi_area_montaje_area_process_tag_in_progress_filters_at_montaje_stage(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);

        $woBefore = WorkOrder::query()->create([
            'code' => 'OT-MONT-IP-BEFORE',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Pendiente->value,
            'created_by' => $user->id,
        ]);
        AreaRequest::query()->create([
            'area' => 'montaje',
            'title' => 'M',
            'body' => 'b',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $woBefore->id,
            'requested_by' => $user->id,
        ]);

        $woAt = WorkOrder::query()->create([
            'code' => 'OT-MONT-IP-AT',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Montaje->value,
            'created_by' => $user->id,
        ]);
        AreaRequest::query()->create([
            'area' => 'montaje',
            'title' => 'M',
            'body' => 'b',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $woAt->id,
            'requested_by' => $user->id,
        ]);

        $r = $this->getJson('/api/work-orders?mi_area=montaje&area_process_tag=in_progress&per_page=20', $h)->assertOk();
        $ids = collect($r->json('data'))->pluck('id')->all();
        $this->assertNotContains($woBefore->id, $ids);
        $this->assertContains($woAt->id, $ids);
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

    public function test_mi_area_area_process_tag_active_includes_queue_and_at_stage(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);

        $woQueued = WorkOrder::query()->create([
            'code' => 'OT-TAG-ACT-QUEUE',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Impresion->value,
            'created_by' => $user->id,
        ]);
        AreaRequest::query()->create([
            'area' => 'laminacion',
            'title' => 'Lam',
            'body' => 'b',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $woQueued->id,
            'requested_by' => $user->id,
        ]);

        $woAtStage = WorkOrder::query()->create([
            'code' => 'OT-TAG-ACT-AT',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Laminacion->value,
            'created_by' => $user->id,
        ]);
        AreaRequest::query()->create([
            'area' => 'laminacion',
            'title' => 'Lam',
            'body' => 'b',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $woAtStage->id,
            'requested_by' => $user->id,
        ]);

        $woPast = WorkOrder::query()->create([
            'code' => 'OT-TAG-ACT-PAST',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Corte->value,
            'created_by' => $user->id,
        ]);
        AreaRequest::query()->create([
            'area' => 'laminacion',
            'title' => 'Lam',
            'body' => 'b',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $woPast->id,
            'requested_by' => $user->id,
        ]);

        $r = $this->getJson('/api/work-orders?mi_area=laminacion&area_process_tag=active&per_page=20', $h)->assertOk();
        $ids = collect($r->json('data'))->pluck('id')->all();
        $this->assertContains($woQueued->id, $ids);
        $this->assertContains($woAtStage->id, $ids);
        $this->assertContains($woPast->id, $ids);
    }

    public function test_mi_area_montaje_active_includes_pending_despite_later_board_stage(): void
    {
        $user = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($user);

        $woAtImpresion = WorkOrder::query()->create([
            'code' => 'OT-MONT-ACT-IMP',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Impresion->value,
            'created_by' => $user->id,
        ]);
        AreaRequest::query()->create([
            'area' => 'montaje',
            'title' => 'OT creada',
            'body' => 'b',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $woAtImpresion->id,
            'requested_by' => $user->id,
        ]);

        $woNueva = WorkOrder::query()->create([
            'code' => 'OT-MONT-ACT-NUEVA',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Nueva->value,
            'created_by' => $user->id,
        ]);
        AreaRequest::query()->create([
            'area' => 'montaje',
            'title' => 'OT creada',
            'body' => 'b',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $woNueva->id,
            'requested_by' => $user->id,
        ]);

        $woPendiente = WorkOrder::query()->create([
            'code' => 'OT-MONT-ACT-PEND',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Pendiente->value,
            'created_by' => $user->id,
        ]);
        AreaRequest::query()->create([
            'area' => 'montaje',
            'title' => 'OT creada',
            'body' => 'b',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $woPendiente->id,
            'requested_by' => $user->id,
        ]);

        $r = $this->getJson('/api/work-orders?mi_area=montaje&area_process_tag=active&per_page=20', $h)->assertOk();
        $ids = collect($r->json('data'))->pluck('id')->all();
        $this->assertContains($woAtImpresion->id, $ids);
        $this->assertContains($woNueva->id, $ids);
        $this->assertContains($woPendiente->id, $ids);
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

    public function test_mont_estado_area_finalizada_completes_pending_montaje_area_request(): void
    {
        $boss = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($boss);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-MONT-FIN-AREA',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Montaje->value,
            'created_by' => $boss->id,
        ]);
        $req = AreaRequest::query()->create([
            'area' => 'montaje',
            'title' => sprintf('OT %s — asignada a Montaje', $wo->code),
            'body' => 'b',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $wo->id,
            'requested_by' => $boss->id,
        ]);

        $baseForm = [
            'pedidoKg' => '100',
            'maquina' => 'M1',
            'tipoImpresionEstructura' => 'superficie',
            'montEstadoArea' => 'abierta',
            'montTurnosMontaje' => [],
            'montTurnoActual' => null,
        ];

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", [
            'form' => array_merge($baseForm, [
                'montEstadoArea' => 'finalizada',
            ]),
            'origin_area' => 'montaje',
        ], $h)->assertOk();

        $this->assertSame(
            AreaRequestStatus::Done->value,
            (string) $req->fresh()->status,
        );

        $activas = $this->getJson('/api/work-orders?mi_area=montaje&area_process_tag=active&per_page=20', $h)->assertOk();
        $this->assertContains($wo->id, collect($activas->json('data'))->pluck('id')->all());

        $historial = $this->getJson('/api/work-orders?historial_area=montaje&historial_exclude_pending=1&per_page=20', $h)->assertOk();
        $this->assertContains($wo->id, collect($historial->json('data'))->pluck('id')->all());
    }

    public function test_historial_montaje_includes_mes_finalizada_without_closed_area_request(): void
    {
        $boss = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($boss);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-MONT-HIST-MES',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Montaje->value,
            'created_by' => $boss->id,
        ]);

        $this->putJson("/api/work-orders/{$wo->id}/orden-trabajo", [
            'form' => [
                'pedidoKg' => '100',
                'maquina' => 'M1',
                'tipoImpresionEstructura' => 'superficie',
                'montEstadoArea' => 'finalizada',
                'montTurnosMontaje' => [],
                'montTurnoActual' => null,
            ],
            'origin_area' => 'montaje',
        ], $h)->assertOk();

        $historial = $this->getJson('/api/work-orders?historial_area=montaje&historial_exclude_pending=1&per_page=20', $h)->assertOk();
        $this->assertContains($wo->id, collect($historial->json('data'))->pluck('id')->all());
    }

    public function test_laminacion_finalizada_in_activas_and_historial(): void
    {
        $boss = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($boss);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-LAM-FIN',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Laminacion->value,
            'created_by' => $boss->id,
        ]);

        AreaRequest::query()->create([
            'area' => 'laminacion',
            'title' => sprintf('OT %s — laminación', $wo->code),
            'body' => 'test',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $wo->id,
            'requested_by' => $boss->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/laminacion-control", [
            'form' => [
                'lamEstadoArea' => 'finalizada',
                'lamTurnosLaminacion' => [],
                'lamTurnoActual' => null,
            ],
            'origin_area' => 'laminacion',
            'notify_on_production_save' => false,
        ], $h)->assertOk();

        $this->assertSame(
            AreaRequestStatus::Done->value,
            (string) AreaRequest::query()->where('work_order_id', $wo->id)->where('area', 'laminacion')->value('status'),
        );

        $activas = $this->getJson('/api/work-orders?mi_area=laminacion&area_process_tag=active&per_page=20', $h)->assertOk();
        $this->assertContains($wo->id, collect($activas->json('data'))->pluck('id')->all());

        $historial = $this->getJson('/api/work-orders?historial_area=laminacion&historial_exclude_pending=1&per_page=20', $h)->assertOk();
        $this->assertContains($wo->id, collect($historial->json('data'))->pluck('id')->all());
    }

    public function test_impresion_finalizada_excluded_from_activas_and_in_historial(): void
    {
        $boss = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($boss);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-IMP-FIN',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Impresion->value,
            'created_by' => $boss->id,
        ]);

        AreaRequest::query()->create([
            'area' => 'impresion',
            'title' => sprintf('OT %s — impresión', $wo->code),
            'body' => 'test',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $wo->id,
            'requested_by' => $boss->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/printing-control", [
            'form' => [
                'impEstadoArea' => 'finalizada',
                'impTurnosImpresion' => [],
                'impTurnoActual' => null,
            ],
            'origin_area' => 'impresion',
            'notify_on_production_save' => false,
        ], $h)->assertOk();

        $this->assertSame(
            AreaRequestStatus::Done->value,
            (string) AreaRequest::query()->where('work_order_id', $wo->id)->where('area', 'impresion')->value('status'),
        );

        $activas = $this->getJson('/api/work-orders?mi_area=impresion&area_process_tag=active&per_page=20', $h)->assertOk();
        $this->assertContains($wo->id, collect($activas->json('data'))->pluck('id')->all());

        $historial = $this->getJson('/api/work-orders?historial_area=impresion&historial_exclude_pending=1&per_page=20', $h)->assertOk();
        $this->assertContains($wo->id, collect($historial->json('data'))->pluck('id')->all());
    }

    public function test_corte_finalizada_closes_pending_area_request_and_in_historial(): void
    {
        $boss = User::factory()->create(['role' => 'boss']);
        $h = $this->auth($boss);
        $wo = WorkOrder::query()->create([
            'code' => 'OT-CORTE-FIN',
            'status' => 'open',
            'board_stage' => WorkOrderBoardStage::Corte->value,
            'created_by' => $boss->id,
        ]);

        AreaRequest::query()->create([
            'area' => 'corte',
            'title' => sprintf('OT %s — corte', $wo->code),
            'body' => 'test',
            'status' => AreaRequestStatus::Pending->value,
            'work_order_id' => $wo->id,
            'requested_by' => $boss->id,
        ]);

        $this->patchJson("/api/work-orders/{$wo->id}/orden-trabajo/corte-control", [
            'form' => [
                'corEstadoArea' => 'finalizada',
                'cor_turnos' => [
                    [
                        'id' => 't1',
                        'operador' => 'Ana',
                        'turno' => 'diurno',
                        'grupo' => 'A',
                        'closed_at' => now()->toIso8601String(),
                        'timer' => ['state' => 'completed', 'effectiveAccSec' => 158, 'deadAccSec' => 0],
                    ],
                ],
                'corTurnoActual' => null,
            ],
            'origin_area' => 'corte',
            'notify_on_production_save' => false,
        ], $h)->assertOk();

        $this->assertSame(
            AreaRequestStatus::Done->value,
            (string) AreaRequest::query()->where('work_order_id', $wo->id)->where('area', 'corte')->value('status'),
        );

        $activas = $this->getJson('/api/work-orders?mi_area=corte&area_process_tag=active&per_page=20', $h)->assertOk();
        $activasRow = collect($activas->json('data'))->firstWhere('id', $wo->id);
        $this->assertNotNull($activasRow, 'OT finalizada debe aparecer en En curso (subpestaña Finalizadas)');
        $this->assertSame(
            'finalizada',
            data_get($activasRow, 'technical_document.form.corEstadoArea'),
        );

        $historial = $this->getJson('/api/work-orders?historial_area=corte&historial_exclude_pending=1&per_page=20', $h)->assertOk();
        $historialRow = collect($historial->json('data'))->firstWhere('id', $wo->id);
        $this->assertNotNull($historialRow, 'OT finalizada debe aparecer en Historial del área corte');
        $this->assertSame(
            'finalizada',
            data_get($historialRow, 'technical_document.form.corEstadoArea'),
        );
    }
}
