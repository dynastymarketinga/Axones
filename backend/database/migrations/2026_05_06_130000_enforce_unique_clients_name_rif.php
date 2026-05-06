<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1) Reparar duplicados existentes (para que el índice único pueda crearse).
        // Estrategia: conservar el menor id y reasignar referencias conocidas antes de borrar.
        DB::transaction(function () {
            // Deduplicar por RIF (ignorar null / vacío).
            $dupRifs = DB::table('clients')
                ->select('rif', DB::raw('COUNT(*) as c'))
                ->whereNotNull('rif')
                ->where('rif', '!=', '')
                ->groupBy('rif')
                ->having('c', '>', 1)
                ->pluck('rif');

            foreach ($dupRifs as $rif) {
                $ids = DB::table('clients')->where('rif', $rif)->orderBy('id')->pluck('id')->all();
                $keepId = (int) array_shift($ids);
                if (! $keepId || $ids === []) {
                    continue;
                }
                // Reasignar referencias típicas.
                if (Schema::hasTable('products') && Schema::hasColumn('products', 'client_id')) {
                    DB::table('products')->whereIn('client_id', $ids)->update(['client_id' => $keepId]);
                }
                if (Schema::hasTable('client_orders') && Schema::hasColumn('client_orders', 'client_id')) {
                    DB::table('client_orders')->whereIn('client_id', $ids)->update(['client_id' => $keepId]);
                }
                DB::table('clients')->whereIn('id', $ids)->delete();
            }

            // Deduplicar por nombre (ignorar null/vacío).
            $dupNames = DB::table('clients')
                ->select('name', DB::raw('COUNT(*) as c'))
                ->whereNotNull('name')
                ->where('name', '!=', '')
                ->groupBy('name')
                ->having('c', '>', 1)
                ->pluck('name');

            foreach ($dupNames as $name) {
                $ids = DB::table('clients')->where('name', $name)->orderBy('id')->pluck('id')->all();
                $keepId = (int) array_shift($ids);
                if (! $keepId || $ids === []) {
                    continue;
                }
                if (Schema::hasTable('products') && Schema::hasColumn('products', 'client_id')) {
                    DB::table('products')->whereIn('client_id', $ids)->update(['client_id' => $keepId]);
                }
                if (Schema::hasTable('client_orders') && Schema::hasColumn('client_orders', 'client_id')) {
                    DB::table('client_orders')->whereIn('client_id', $ids)->update(['client_id' => $keepId]);
                }
                DB::table('clients')->whereIn('id', $ids)->delete();
            }
        });

        // 2) Índices únicos (BD).
        Schema::table('clients', function (Blueprint $table) {
            // rif ya era index normal; lo convertimos a unique.
            $table->unique('rif', 'clients_rif_unique');
            $table->unique('name', 'clients_name_unique');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropUnique('clients_rif_unique');
            $table->dropUnique('clients_name_unique');
        });
    }
};

