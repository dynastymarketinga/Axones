<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Deduplicar antes de crear índices únicos.
        DB::transaction(function () {
            // Duplicados por RIF (no null / no vacío)
            $dupRifs = DB::table('suppliers')
                ->select('rif', DB::raw('COUNT(*) as c'))
                ->whereNotNull('rif')
                ->where('rif', '!=', '')
                ->groupBy('rif')
                ->having('c', '>', 1)
                ->pluck('rif');

            foreach ($dupRifs as $rif) {
                $ids = DB::table('suppliers')->where('rif', $rif)->orderBy('id')->pluck('id')->all();
                $keepId = (int) array_shift($ids);
                if (! $keepId || $ids === []) {
                    continue;
                }

                if (Schema::hasTable('materials') && Schema::hasColumn('materials', 'supplier_id')) {
                    DB::table('materials')->whereIn('supplier_id', $ids)->update(['supplier_id' => $keepId]);
                }
                if (Schema::hasTable('purchase_orders') && Schema::hasColumn('purchase_orders', 'supplier_id')) {
                    DB::table('purchase_orders')->whereIn('supplier_id', $ids)->update(['supplier_id' => $keepId]);
                }
                if (Schema::hasTable('purchase_receipts') && Schema::hasColumn('purchase_receipts', 'supplier_id')) {
                    DB::table('purchase_receipts')->whereIn('supplier_id', $ids)->update(['supplier_id' => $keepId]);
                }

                DB::table('suppliers')->whereIn('id', $ids)->delete();
            }

            // Duplicados por nombre (no vacío)
            $dupNames = DB::table('suppliers')
                ->select('name', DB::raw('COUNT(*) as c'))
                ->whereNotNull('name')
                ->where('name', '!=', '')
                ->groupBy('name')
                ->having('c', '>', 1)
                ->pluck('name');

            foreach ($dupNames as $name) {
                $ids = DB::table('suppliers')->where('name', $name)->orderBy('id')->pluck('id')->all();
                $keepId = (int) array_shift($ids);
                if (! $keepId || $ids === []) {
                    continue;
                }

                if (Schema::hasTable('materials') && Schema::hasColumn('materials', 'supplier_id')) {
                    DB::table('materials')->whereIn('supplier_id', $ids)->update(['supplier_id' => $keepId]);
                }
                if (Schema::hasTable('purchase_orders') && Schema::hasColumn('purchase_orders', 'supplier_id')) {
                    DB::table('purchase_orders')->whereIn('supplier_id', $ids)->update(['supplier_id' => $keepId]);
                }
                if (Schema::hasTable('purchase_receipts') && Schema::hasColumn('purchase_receipts', 'supplier_id')) {
                    DB::table('purchase_receipts')->whereIn('supplier_id', $ids)->update(['supplier_id' => $keepId]);
                }

                DB::table('suppliers')->whereIn('id', $ids)->delete();
            }
        });

        Schema::table('suppliers', function (Blueprint $table) {
            $table->unique('name', 'suppliers_name_unique');
            $table->unique('rif', 'suppliers_rif_unique');
        });
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropUnique('suppliers_name_unique');
            $table->dropUnique('suppliers_rif_unique');
        });
    }
};

