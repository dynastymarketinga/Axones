<?php

namespace Tests\Feature;

use App\Http\Middleware\EnsureAreaRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class WorkOrderAreaRoleAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private function makeRequestFor(User $user): Request
    {
        $request = Request::create('/api/work-orders/1/printing', 'GET');
        $request->setUserResolver(fn () => $user);

        return $request;
    }

    public function test_printing_area_allows_printing_and_full_access_roles(): void
    {
        $middleware = new EnsureAreaRole;
        $printing = User::factory()->create(['role' => 'impresion']);
        $boss = User::factory()->create(['role' => 'boss']);
        $next = fn () => response()->json(['ok' => true]);

        $printingResponse = $middleware->handle($this->makeRequestFor($printing), $next, 'printing');
        $bossResponse = $middleware->handle($this->makeRequestFor($boss), $next, 'printing');

        $this->assertSame(200, $printingResponse->getStatusCode());
        $this->assertSame(200, $bossResponse->getStatusCode());
    }

    public function test_middleware_rejects_roles_outside_area_scope(): void
    {
        $middleware = new EnsureAreaRole;
        User::factory()->create(['role' => 'boss']);
        $laminacion = User::factory()->create(['role' => 'laminacion']);
        $inventory = User::factory()->create(['role' => 'inventory']);
        $next = fn () => response()->json(['ok' => true]);

        $printingDenied = $middleware->handle($this->makeRequestFor($laminacion), $next, 'printing');
        $planillaDenied = $middleware->handle($this->makeRequestFor($inventory), $next, 'planilla');

        $this->assertSame(403, $printingDenied->getStatusCode());
        $this->assertSame(403, $planillaDenied->getStatusCode());
    }

    public function test_planilla_write_denies_printing_operator(): void
    {
        User::factory()->create();
        $middleware = new EnsureAreaRole;
        $printing = User::factory()->create(['role' => 'impresion']);
        $next = fn () => response()->json(['ok' => true]);

        $denied = $middleware->handle($this->makeRequestFor($printing), $next, 'planilla_write');

        $this->assertSame(403, $denied->getStatusCode());
    }

    public function test_planilla_read_allows_printing_operator(): void
    {
        $middleware = new EnsureAreaRole;
        $printing = User::factory()->create(['role' => 'impresion']);
        $next = fn () => response()->json(['ok' => true]);

        $ok = $middleware->handle($this->makeRequestFor($printing), $next, 'planilla_read');

        $this->assertSame(200, $ok->getStatusCode());
    }
}
