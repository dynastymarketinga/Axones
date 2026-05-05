<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryChangeApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_create_and_decide_inventory_change_approval(): void
    {
        $requester = User::factory()->create(['role' => 'inventory']);
        $approver = User::factory()->create(['role' => 'boss']);

        $requesterToken = $requester->createToken('requester')->plainTextToken;
        $approverToken = $approver->createToken('approver')->plainTextToken;

        $create = $this->postJson('/api/inventory-change-approvals', [
            'entity_type' => 'bobina',
            'entity_id' => 99,
            'change_payload' => ['status' => 'rejected'],
            'reason_text' => 'Cambio mayor de prueba',
        ], [
            'Authorization' => "Bearer {$requesterToken}",
        ])->assertCreated();

        $approvalId = (int) $create->json('id');
        $this->assertGreaterThan(0, $approvalId);

        $this->patchJson("/api/inventory-change-approvals/{$approvalId}/decision", [
            'status' => 'approved',
            'decision_notes' => 'Aprobado por jefatura',
        ], [
            'Authorization' => "Bearer {$approverToken}",
        ])->assertOk()->assertJsonPath('status', 'approved');
    }
}
