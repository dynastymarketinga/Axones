<?php

namespace App\Console\Commands;

use App\Enums\AreaRequestStatus;
use App\Enums\WorkOrderBoardStage;
use App\Enums\WorkOrderStatus;
use App\Models\AreaRequest;
use App\Models\WorkOrder;
use Illuminate\Console\Command;

/**
 * OT creadas antes de incluir Montaje en PRODUCTIVE_AREAS no tienen fila en area_requests para montaje.
 * La bandeja /api/work-orders?mi_area=montaje exige solicitud pendiente + etapa tablero adecuada.
 */
class BackfillMontajeAreaRequestsCommand extends Command
{
    protected $signature = 'axones:backfill-montaje-area-requests {--dry-run : Solo listar OT que recibirían solicitud}';

    protected $description = 'Crea solicitud de área pendiente «Montaje» para OT abiertas en etapa nueva/pendiente/montaje que aún no la tengan.';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');

        $allowedStages = [
            WorkOrderBoardStage::Nueva->value,
            WorkOrderBoardStage::Pendiente->value,
            WorkOrderBoardStage::Montaje->value,
        ];

        $wouldCreate = 0;
        $skipped = 0;

        $query = WorkOrder::query()
            ->where('status', '!=', WorkOrderStatus::Cancelled->value)
            ->whereIn('board_stage', $allowedStages);

        foreach ($query->cursor() as $wo) {
            $already = AreaRequest::query()
                ->where('work_order_id', $wo->getKey())
                ->where('area', 'montaje')
                ->where('status', AreaRequestStatus::Pending->value)
                ->exists();

            if ($already) {
                $skipped++;

                continue;
            }

            if ($dry) {
                $this->line("[dry-run] OT {$wo->code} (id {$wo->id}, etapa {$wo->board_stage->value})");
                $wouldCreate++;

                continue;
            }

            $title = sprintf('OT %s creada', $wo->code);
            AreaRequest::query()->create([
                'area' => 'montaje',
                'title' => $title,
                'body' => sprintf(
                    'Nueva OT %s creada en planificación. Revise y programe en Montaje.',
                    $wo->code,
                ),
                'status' => AreaRequestStatus::Pending->value,
                'work_order_id' => $wo->getKey(),
                'requested_by' => null,
            ]);
            $wouldCreate++;
        }

        if ($dry) {
            $this->info("Dry-run: {$wouldCreate} OT sin solicitud Montaje pendiente; {$skipped} ya tenían.");
        } else {
            $this->info("Creadas {$wouldCreate} solicitudes Montaje; {$skipped} omitidas (ya existía pendiente).");
        }

        return self::SUCCESS;
    }
}
