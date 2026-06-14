<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class TruncateKeepUsersCommand extends Command
{
    protected $signature = 'axones:truncate-keep-users
                            {--force : Obligatorio en production y para omitir confirmación}
                            {--dry-run : Solo listar tablas que se vaciarían}';

    protected $description = 'Vacía todas las tablas de la BD excepto users, sessions, personal_access_tokens y migrations.';

    /** @var list<string> */
    private array $preserve = [
        'users',
        'sessions',
        'personal_access_tokens',
        'migrations',
    ];

    public function handle(): int
    {
        if (app()->environment('production') && ! $this->option('force')) {
            $this->error('En production debe usar --force.');

            return self::FAILURE;
        }

        $tables = $this->tablesToTruncate();

        if ($tables === []) {
            $this->warn('No hay tablas para vaciar.');

            return self::SUCCESS;
        }

        if ($this->option('dry-run')) {
            $this->info('Tablas a vaciar ('.count($tables).'):');
            foreach ($tables as $table) {
                $this->line("  - {$table}");
            }
            $this->newLine();
            $this->info('Conservadas: '.implode(', ', $this->preserve));

            return self::SUCCESS;
        }

        if (! $this->option('force') && ! $this->confirm(
            '¿Vaciar '.count($tables).' tablas? Se conservan users, sessions, personal_access_tokens y migrations.',
            false,
        )) {
            $this->line('Cancelado.');

            return self::SUCCESS;
        }

        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
        } elseif ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = OFF');
        }

        $bar = $this->output->createProgressBar(count($tables));
        $bar->start();

        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->truncate();
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        if ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        } elseif ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON');
        }

        $this->cleanUploadDirectories();

        $this->info('OK: '.count($tables).' tablas vaciadas.');
        $this->line('Conservadas: '.implode(', ', $this->preserve));

        return self::SUCCESS;
    }

    /**
     * @return list<string>
     */
    private function tablesToTruncate(): array
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql') {
            $dbName = DB::connection()->getDatabaseName();
            $rows = DB::select(
                'SELECT TABLE_NAME AS name FROM information_schema.TABLES
                 WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = ?',
                [$dbName, 'BASE TABLE'],
            );

            return collect($rows)
                ->pluck('name')
                ->filter(fn (string $name) => ! in_array($name, $this->preserve, true))
                ->sort()
                ->values()
                ->all();
        }

        if ($driver === 'sqlite') {
            $rows = DB::select("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");

            return collect($rows)
                ->pluck('name')
                ->filter(fn (string $name) => ! in_array($name, $this->preserve, true))
                ->sort()
                ->values()
                ->all();
        }

        $this->warn("Driver {$driver}: usando listado estático de tablas.");

        return collect($this->fallbackTables())
            ->filter(fn (string $name) => ! in_array($name, $this->preserve, true))
            ->sort()
            ->values()
            ->all();
    }

    private function cleanUploadDirectories(): void
    {
        foreach (['miscellaneous_receipts', 'gate_photos', 'demo_files'] as $dir) {
            try {
                Storage::disk('local')->deleteDirectory($dir);
            } catch (\Throwable) {
                // Adjuntos opcionales; no bloquear el reset.
            }
        }
    }

    /**
     * @return list<string>
     */
    private function fallbackTables(): array
    {
        return [
            'area_requests',
            'bobinas',
            'cache_locks',
            'clients',
            'client_orders',
            'client_order_lines',
            'corte_bobina_usages',
            'corte_time_segments',
            'delivery_notes',
            'delivery_note_lines',
            'failed_jobs',
            'gate_movements',
            'inventory_change_approvals',
            'inventory_movements',
            'inventory_returns',
            'jobs',
            'job_batches',
            'laminacion_bobina_usages',
            'laminacion_time_segments',
            'materials',
            'material_product',
            'material_requests',
            'material_request_lines',
            'miscellaneous_receipts',
            'miscellaneous_receipt_attachments',
            'montaje_material_usages',
            'montaje_time_segments',
            'operational_alerts',
            'password_reset_requests',
            'password_reset_tokens',
            'printing_bobina_usages',
            'printing_chemical_usages',
            'printing_ink_control_lines',
            'printing_time_segments',
            'products',
            'product_ink_material',
            'purchase_orders',
            'purchase_order_lines',
            'purchase_receipts',
            'purchase_receipt_lines',
            'suppliers',
            'tintas_time_segments',
            'tinta_mixtures',
            'tinta_mixture_components',
            'tinta_subareas',
            'vendors',
            'work_orders',
            'work_order_corte_summaries',
            'work_order_laminacion_summaries',
            'work_order_lines',
            'work_order_montaje_summaries',
            'work_order_printing_summaries',
            'work_order_production_items',
            'work_order_quality_records',
            'work_order_technical_documents',
            'work_order_tintas_summaries',
        ];
    }
}
