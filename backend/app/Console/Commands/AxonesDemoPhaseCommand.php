<?php

namespace App\Console\Commands;

use App\Services\AxonesDemoDataService;
use Illuminate\Console\Command;

class AxonesDemoPhaseCommand extends Command
{
    protected $signature = 'axones:demo:phase
                            {steps?* : Pasos: reset, masters, compras, inventario_extra, ventas_ot, operaciones, grafo_demo, flow}
                            {--volume=20 : Filas objetivo por tabla (5–200 sin --minimal; con --minimal 1–200)}
                            {--minimal : Modo comparación mínima (sin pedidos/OT ni grafo pesado en --all)}
                            {--micro : Flujo completo con volumen 1 (una OT y pocas filas por tabla; incluye impresión/laminación/corte/tintas en --all)}
                            {--all : Ejecuta la cadena completa en orden (con --minimal omite ventas_ot y grafo_demo; con --micro usa cadena completa y volumen 1)}
                            {--with-flow : Con --all: ejecuta también la fase flow al final}
                            {--flow-manual-corte : Con la fase flow: crea OT-DEMO-FLUJO sin kg terminados en Corte (despacho vacío hasta registrar)}';

    protected $description = 'Semilla datos demo Axones por fases (maestros → compras → inventario → ventas/OT → operaciones → grafo).';

    /** @var list<string> */
    private const CHAIN_FULL = ['reset', 'masters', 'compras', 'inventario_extra', 'ventas_ot', 'operaciones', 'grafo_demo'];

    /** @var list<string> */
    private const CHAIN_MINIMAL = ['reset', 'masters', 'compras', 'inventario_extra', 'operaciones'];

    public function handle(AxonesDemoDataService $demo): int
    {
        if (app()->environment('production')) {
            $this->error('Este comando no puede ejecutarse en entorno production.');

            return self::FAILURE;
        }

        if ($this->option('minimal') && $this->option('micro')) {
            $this->error('No combine --minimal con --micro. Use solo --micro para volumen 1 con orden de trabajo y grafo de áreas.');

            return self::FAILURE;
        }

        $demo->preparePhaseRun(
            (int) $this->option('volume'),
            (bool) $this->option('minimal'),
            (bool) $this->option('micro'),
        );

        /** @var array<int, string> $steps */
        $steps = $this->argument('steps');
        $steps = is_array($steps) ? $steps : [];

        if ($this->option('all')) {
            $steps = ($this->option('minimal') && ! $this->option('micro')) ? self::CHAIN_MINIMAL : self::CHAIN_FULL;
            if ($this->option('with-flow')) {
                $steps[] = 'flow';
            }
        }

        if ($steps === []) {
            $this->error('Indique al menos un paso o use --all. Pasos: '.implode(', ', array_merge(self::CHAIN_FULL, ['flow'])));

            return self::FAILURE;
        }

        $flowManualCorte = (bool) $this->option('flow-manual-corte');

        foreach ($steps as $step) {
            $step = strtolower(trim((string) $step));
            try {
                $result = match ($step) {
                    'reset' => $demo->runPhaseReset(keepUsers: true),
                    'masters' => $demo->runPhaseMasters(),
                    'compras' => $demo->runPhaseCompras(),
                    'inventario_extra' => $demo->runPhaseInventarioExtra(),
                    'ventas_ot' => $demo->runPhaseVentasOt(),
                    'operaciones' => $demo->runPhaseOperaciones(),
                    'grafo_demo' => $demo->runPhaseGrafoDemo(),
                    'flow' => $demo->runPhaseFlow(createFinishedUsage: ! $flowManualCorte),
                    default => throw new \InvalidArgumentException('Paso desconocido: '.$step.'. Use: '.implode(', ', array_merge(self::CHAIN_FULL, ['flow']))),
                };
            } catch (\Throwable $e) {
                $this->error("[{$step}] ".$e->getMessage());

                return self::FAILURE;
            }

            $this->info("[{$step}] OK");
            $this->line(json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $this->newLine();
        }

        $this->warn('Contraseña de cuentas demo (password) si creó el reset en esta sesión.');

        return self::SUCCESS;
    }
}
