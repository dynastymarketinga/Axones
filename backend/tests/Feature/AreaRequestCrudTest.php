<?php

namespace Tests\Feature;

use App\Enums\AreaRequestStatus;
use App\Models\AreaRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AreaRequestCrudTest extends TestCase
{
    use RefreshDatabase;

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
    }

    public function test_pending_area_request_can_be_deleted(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $r = AreaRequest::query()->create([
            'area' => 'impresion',
            'title' => 'Pase',
            'status' => AreaRequestStatus::Pending->value,
            'requested_by' => $user->id,
        ]);

        $this->deleteJson("/api/area-requests/{$r->id}", [], $h)->assertNoContent();
        $this->assertDatabaseMissing('area_requests', ['id' => $r->id]);
    }

    public function test_done_area_request_cannot_be_deleted(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $r = AreaRequest::query()->create([
            'area' => 'impresion',
            'title' => 'Listo',
            'status' => AreaRequestStatus::Done->value,
            'requested_by' => $user->id,
        ]);

        $this->deleteJson("/api/area-requests/{$r->id}", [], $h)->assertUnprocessable();
        $this->assertDatabaseHas('area_requests', ['id' => $r->id]);
    }

    public function test_title_update_only_when_pending(): void
    {
        $user = User::factory()->create();
        $h = $this->auth($user);

        $r = AreaRequest::query()->create([
            'area' => 'corte',
            'title' => 'Original',
            'status' => AreaRequestStatus::Done->value,
            'requested_by' => $user->id,
        ]);

        $this->patchJson("/api/area-requests/{$r->id}", ['title' => 'Otro'], $h)->assertUnprocessable();
    }
}
