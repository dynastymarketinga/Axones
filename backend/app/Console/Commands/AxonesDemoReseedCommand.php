<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\AxonesDemoDataService;
use Illuminate\Console\Command;

class AxonesDemoReseedCommand extends Command
{
    protected $signature = 'axones:demo:reseed {--manual : Solo vaciar dominio y recrear usuarios demo (sin materiales/OC/OT); para flujo completo a mano en UI} {--flow-manual-corte : Crea OT-DEMO-FLUJO precargada para Corte pero sin kg terminados; para probar el flujo manual Corte→Despacho} {--full : Demo con volumen alto (muchas filas); sin esto se usa modo comparación minimal} {--volume=20 : Solo con --full: filas objetivo (5-200)}';

    protected $description = 'Limpia dominio (conserva filas en users): --manual = solo usuarios demo y tablas vacías; sin --manual/--full = minimal + OT-DEMO-FLUJO; --full = volumen demo grande';

    public function handle(AxonesDemoDataService $demo): int
    {
        if (app()->environment('production')) {
            $this->error('Este comando no puede ejecutarse en entorno production.');

            return self::FAILURE;
        }

        if ((bool) $this->option('manual')) {
            $this->info('Reset MANUAL: tablas de dominio vacías; usuarios demo restaurados.');
            $this->warn('Contraseña de todas las cuentas listadas: password');
            $summary = $demo->resetDomainForManualProcedure();
            $this->line(json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $this->newLine();
            $this->line('Entra como jefe para crear datos maestros y planillas: boss@axones.local o boss@axones.demo');

            return self::SUCCESS;
        }

        $full = (bool) $this->option('full');

        if ($full) {
            $volume = (int) $this->option('volume');
            $volume = max(5, min(200, $volume > 0 ? $volume : 20));
            $this->info("Sembrando demo COMPLETO (volume={$volume})…");
            $summary = $demo->seed($volume, false);
        } else {
            $this->info('Sembrando demo MINIMAL (comparación especificación vs terminado; pocas filas)…');
            $summary = $demo->seed(1, true);
        }
        $this->line(json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $printing = User::query()->where('email', 'impresion@axones.local')->first()
            ?? User::query()->where('email', 'impresion@axones.demo')->first();
        $boss = User::query()->where('email', 'boss@axones.local')->first()
            ?? User::query()->where('email', 'boss@axones.demo')->first();

        if (! $printing || ! $boss) {
            $this->error('No se encontró impresion@axones.local / impresion@axones.demo ni boss@axones.local / boss@axones.demo tras el seed.');

            return self::FAILURE;
        }

        $this->newLine();
        $manualFlow = (bool) $this->option('flow-manual-corte');
        $this->info($manualFlow
            ? 'Añadiendo escenario OT-DEMO-FLUJO (manual desde Corte; sin terminado)…'
            : 'Añadiendo escenario destacado OT-DEMO-FLUJO…'
        );
        $flow = $demo->seedHighlightedFlowScenario($printing, $boss, ! $manualFlow);

        $this->newLine();
        $this->info('Listo. Comparación sugerida en el frontend:');
        $this->line('  • Datos maestros → Especificaciones de producto: «BOLSA HARINA 5KG (DEMO FLUJO)» (CPE-DEMO-FLUJO).');
        $this->line('  • Inventario → Materiales (insumos): sustratos/tintas/etc.');
        if ($manualFlow) {
            $this->line('  • Corte → OT-DEMO-FLUJO precargada (cabecera + corte) para que registres terminado manualmente.');
            $this->line('  • Despacho → inicialmente vacío para OT-DEMO-FLUJO hasta que registres kg terminados en Corte.');
        } else {
            $this->line('  • Despacho → Producto terminado: fila OT-DEMO-FLUJO con saldo 92,000 kg (sin nota aún).');
        }
        if (! $full) {
            $this->line('  • Modo minimal: listados cortos; en despacho solo debería destacarse OT-DEMO-FLUJO para terminado.');
        }
        $this->line('  • Ruta UI típica: /axones/despacho-corte (según basename de tu Vite).');
        $this->newLine();
        $this->line('Detalle API: '.json_encode($flow, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return self::SUCCESS;
    }
}
