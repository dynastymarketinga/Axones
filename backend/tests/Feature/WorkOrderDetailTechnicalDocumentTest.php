<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderTechnicalDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkOrderDetailTechnicalDocumentTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_show_work_order_includes_technical_document_form(): void
    {
        $user = User::factory()->create();
        $headers = $this->auth($user);

        $wo = WorkOrder::query()->create([
            'code' => 'OT-DETAIL-1',
            'status' => 'open',
            'created_by' => $user->id,
        ]);

        WorkOrderTechnicalDocument::query()->create([
            'work_order_id' => $wo->id,
            'form' => [
                'pinonImp' => '850',
                'lineaCorte' => 'si',
                'figEmbImpDisplay' => '4',
                'tintaColor1' => 'AMARILLO',
                'tintaAnilox1' => '24S',
                'tintaVisc1' => '343',
                'tintaObs1' => '324',
            ],
        ]);

        $this->getJson("/api/work-orders/{$wo->id}", $headers)
            ->assertOk()
            ->assertJsonPath('technical_document.form.pinonImp', '850')
            ->assertJsonPath('technical_document.form.lineaCorte', 'si')
            ->assertJsonPath('technical_document.form.tintaColor1', 'AMARILLO');
    }
}
