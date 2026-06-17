<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\MaterialBulkImportService;
use App\Services\ProductBulkImportService;
use Illuminate\Console\Command;
use RuntimeException;

class ImportSeedExcelCommand extends Command
{
    protected $signature = 'axones:import-seed-excel
                            {--listado= : Ruta a LISTADO DE PRODUCTOS.xlsx}
                            {--victor= : Ruta a INVENTARIO VICTOR.xlsx}
                            {--dry-run : Simular sin guardar}
                            {--force : Obligatorio en production}';

    protected $description = 'Importa listado de productos e inventario Victor desde Excel (mismos parsers que la UI).';

    public function handle(
        ProductBulkImportService $productImport,
        MaterialBulkImportService $materialImport,
    ): int {
        if (app()->environment('production') && ! $this->option('force')) {
            $this->error('En production debe usar --force.');

            return self::FAILURE;
        }

        $repoRoot = dirname(base_path());
        $listadoPath = (string) ($this->option('listado') ?: $repoRoot.'/scripts/seed-data/LISTADO DE PRODUCTOS.xlsx');
        $victorPath = (string) ($this->option('victor') ?: $repoRoot.'/scripts/seed-data/INVENTARIO VICTOR.xlsx');
        $dryRun = (bool) $this->option('dry-run');

        foreach ([$listadoPath, $victorPath] as $path) {
            if (! is_file($path)) {
                $this->error("No existe el archivo: {$path}");

                return self::FAILURE;
            }
        }

        $this->info('Parseando Excel…');
        $payload = $this->parseWithNode($listadoPath, $victorPath);

        $listado = $payload['listado'] ?? [];
        $victor = $payload['victor'] ?? [];

        $this->line('Listado: '.count($listado['products'] ?? []).' productos, '.count($listado['clients'] ?? []).' clientes');
        $this->line('Victor: '.count($victor['rows'] ?? []).' filas de material');

        foreach ($listado['issues'] ?? [] as $issue) {
            $this->warn("Listado [{$issue['sheet_name']} fila {$issue['row_number']}]: {$issue['message']}");
        }
        foreach ($victor['issues'] ?? [] as $issue) {
            $this->warn("Victor [{$issue['sheet_name']} fila {$issue['row_number']}]: {$issue['message']}");
        }

        if ($dryRun) {
            $this->warn('Modo dry-run: no se guardará nada.');
        }

        $this->info('Importando productos y clientes…');
        $productResult = $productImport->import(
            $listado['clients'] ?? [],
            $listado['products'] ?? [],
            $dryRun,
            (string) ($listado['source_filename'] ?? basename($listadoPath)),
        );

        $this->table(
            ['Métrica', 'Valor'],
            [
                ['Clientes creados', $productResult['clients_created']],
                ['Clientes actualizados', $productResult['clients_updated']],
                ['Productos creados', $productResult['products_created']],
                ['Productos actualizados', $productResult['products_updated']],
                ['Sin cambios', $productResult['unchanged']],
                ['Errores', count($productResult['errors'])],
            ],
        );

        foreach ($productResult['errors'] as $error) {
            $this->error("Producto [{$error['name']}]: {$error['message']}");
        }

        $user = $this->resolveImportUser();
        if (! $user) {
            $this->error('No hay usuarios en la BD para registrar movimientos de inventario.');

            return self::FAILURE;
        }

        $this->info("Importando materiales (usuario: {$user->email})…");
        $materialResult = $materialImport->import(
            $victor['rows'] ?? [],
            $user,
            $dryRun,
            (string) ($victor['source_filename'] ?? basename($victorPath)),
        );

        $this->table(
            ['Métrica', 'Valor'],
            [
                ['Materiales creados', $materialResult['created']],
                ['Materiales actualizados', $materialResult['updated']],
                ['Stock ajustado', $materialResult['stock_adjusted']],
                ['Sin cambios', $materialResult['unchanged']],
                ['Errores', count($materialResult['errors'])],
            ],
        );

        foreach ($materialResult['errors'] as $error) {
            $this->error("Material [{$error['sku']}]: {$error['message']}");
        }

        $totalErrors = count($productResult['errors']) + count($materialResult['errors']);
        if ($totalErrors > 0) {
            $this->warn("Importación completada con {$totalErrors} error(es).");

            return self::FAILURE;
        }

        $this->info($dryRun ? 'Dry-run OK.' : 'Importación de fábrica completada.');

        return self::SUCCESS;
    }

    /**
     * @return array<string, mixed>
     */
    private function parseWithNode(string $listadoPath, string $victorPath): array
    {
        $repoRoot = dirname(base_path());
        $uiRoot = $repoRoot.'/pulse-ui-react';
        $script = $uiRoot.'/scripts/import-seed-excel-cli.ts';

        if (! is_file($script)) {
            throw new RuntimeException("No se encontró el parser Node: {$script}");
        }

        $npx = PHP_OS_FAMILY === 'Windows' ? 'npx.cmd' : 'npx';
        $tsxCli = $uiRoot.'/node_modules/tsx/dist/cli.mjs';
        $node = PHP_OS_FAMILY === 'Windows' ? 'node.exe' : 'node';

        if (is_file($tsxCli)) {
            $runner = escapeshellarg($node).' '.escapeshellarg($tsxCli);
        } else {
            $runner = escapeshellarg($npx).' --yes tsx';
        }

        $cmd = sprintf(
            '%s %s %s %s',
            $runner,
            escapeshellarg($script),
            escapeshellarg($listadoPath),
            escapeshellarg($victorPath),
        );

        $previousDir = getcwd() ?: $uiRoot;
        chdir($uiRoot);

        $descriptor = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
        $process = proc_open($cmd, $descriptor, $pipes, $uiRoot);

        if (! is_resource($process)) {
            chdir($previousDir);
            throw new RuntimeException('No se pudo ejecutar el parser Node (npx tsx).');
        }

        fclose($pipes[0]);
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($process);
        chdir($previousDir);

        if ($exitCode !== 0) {
            throw new RuntimeException(trim($stderr ?: $stdout ?: 'Error al parsear Excel con Node.'));
        }

        $decoded = json_decode(trim((string) $stdout), true);
        if (! is_array($decoded)) {
            throw new RuntimeException('Salida JSON inválida del parser Node.');
        }

        return $decoded;
    }

    private function resolveImportUser(): ?User
    {
        return User::query()
            ->where('email', 'victorcarrillox2@gmail.com')
            ->first()
            ?? User::query()->where('active', true)->orderBy('id')->first()
            ?? User::query()->orderBy('id')->first();
    }
}
