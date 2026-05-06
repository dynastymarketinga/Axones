<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Deduplicar por (client_id, name) antes de crear índice único.
        DB::transaction(function () {
            $dups = DB::table('products')
                ->select('client_id', 'name', DB::raw('COUNT(*) as c'))
                ->whereNotNull('name')
                ->where('name', '!=', '')
                ->groupBy('client_id', 'name')
                ->having('c', '>', 1)
                ->get();

            foreach ($dups as $row) {
                $clientId = $row->client_id;
                $name = $row->name;
                $ids = DB::table('products')
                    ->where('client_id', $clientId)
                    ->where('name', $name)
                    ->orderBy('id')
                    ->pluck('id')
                    ->all();

                $keepId = (int) array_shift($ids);
                if (! $keepId || $ids === []) {
                    continue;
                }

                // Reasignar relaciones típicas.
                if (Schema::hasTable('work_orders') && Schema::hasColumn('work_orders', 'product_id')) {
                    DB::table('work_orders')->whereIn('product_id', $ids)->update(['product_id' => $keepId]);
                }
                if (Schema::hasTable('material_product') && Schema::hasColumn('material_product', 'product_id')) {
                    DB::table('material_product')->whereIn('product_id', $ids)->update(['product_id' => $keepId]);
                }
                if (Schema::hasTable('product_ink_material') && Schema::hasColumn('product_ink_material', 'product_id')) {
                    DB::table('product_ink_material')->whereIn('product_id', $ids)->update(['product_id' => $keepId]);
                }

                DB::table('products')->whereIn('id', $ids)->delete();
            }
        });

        Schema::table('products', function (Blueprint $table) {
            $table->unique(['client_id', 'name'], 'products_client_name_unique');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique('products_client_name_unique');
        });
    }
};

