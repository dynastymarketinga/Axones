<?php

namespace App\Console\Commands;

use App\Models\WorkOrder;
use App\Models\WorkOrderTechnicalDocument;
use App\Support\MontajePlanillaMetrics;
use Illuminate\Console\Command;

class RecalcMontajeMetricsCommand extends Command
{
    protected $signature = 'work-orders:recalc-montaje-metrics
                            {code? : Código OT (ej. OT-2026-00001). Sin argumento: todas las OT con documento técnico}';

    protected $description = 'Recalcula desarrollo y ancho montaje (auto) en work_order_technical_documents';

    public function handle(): int
    {
        $code = $this->argument('code');
        $query = WorkOrderTechnicalDocument::query()->with('workOrder');

        if (is_string($code) && trim($code) !== '') {
            $wo = WorkOrder::query()->where('code', trim($code))->first();
            if ($wo === null) {
                $this->error("No se encontró la OT {$code}.");

                return self::FAILURE;
            }
            $query->where('work_order_id', $wo->getKey());
        }

        $updated = 0;
        foreach ($query->cursor() as $doc) {
            if (! is_array($doc->form)) {
                continue;
            }
            $before = $doc->form;
            $after = MontajePlanillaMetrics::applyAutoFields($before);
            if ($after === $before) {
                continue;
            }
            $doc->form = $after;
            $doc->save();
            $updated++;
            $woCode = $doc->workOrder?->code ?? (string) $doc->work_order_id;
            $this->line(sprintf(
                '%s: desarrollo %s → %s | ancho %s → %s',
                $woCode,
                $before['desarrollo'] ?? '—',
                $after['desarrollo'] ?? '—',
                $before['anchoMontaje'] ?? '—',
                $after['anchoMontaje'] ?? '—',
            ));
        }

        $this->info("Documentos actualizados: {$updated}.");

        return self::SUCCESS;
    }
}
