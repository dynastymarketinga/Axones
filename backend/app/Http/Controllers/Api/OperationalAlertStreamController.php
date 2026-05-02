<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OperationalAlert;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OperationalAlertStreamController extends Controller
{
    /**
     * SSE con sondeo a BD: entrega alertas nuevas visibles para el usuario (mismo criterio que GET /alerts).
     * Con after_id=0 se posiciona en el último id existente para no reproducir historial al conectar.
     */
    public function stream(Request $request): StreamedResponse
    {
        $user = $request->user();
        $afterId = max(0, (int) $request->query('after_id', 0));
        if ($afterId === 0) {
            $afterId = (int) (OperationalAlert::query()->max('id') ?? 0);
        }

        return response()->stream(function () use ($user, $afterId) {
            if (function_exists('set_time_limit')) {
                @set_time_limit(0);
            }
            $lastId = $afterId;
            $deadline = time() + (App::runningUnitTests() ? 2 : 50);

            while (time() < $deadline) {
                $rows = OperationalAlert::query()
                    ->with(['workOrder:id,code', 'material:id,sku,name'])
                    ->visibleTo($user)
                    ->where('id', '>', $lastId)
                    ->orderBy('id')
                    ->limit(25)
                    ->get();

                foreach ($rows as $alert) {
                    $lastId = $alert->getKey();
                    echo 'id: '.$alert->getKey()."\n";
                    echo 'data: '.json_encode($alert->toArray(), JSON_UNESCAPED_UNICODE)."\n\n";
                }

                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();

                if ($rows->isEmpty()) {
                    echo ": ping\n\n";
                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
                    flush();
                    sleep(1);
                } else {
                    usleep(150_000);
                }
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
