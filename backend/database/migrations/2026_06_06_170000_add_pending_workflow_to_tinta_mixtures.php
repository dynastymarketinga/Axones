<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tinta_mixtures', function (Blueprint $table) {
            $table->string('status', 24)->default('pending')->after('id');
            $table->foreignId('material_request_id')->nullable()->after('work_order_id')->constrained('material_requests')->nullOnDelete();
            $table->string('output_sku')->nullable()->after('output_material_id');
            $table->string('output_name')->nullable()->after('output_sku');
            $table->string('output_inventory_area', 32)->nullable()->after('output_name');
            $table->string('output_tinta_subarea', 32)->nullable()->after('output_inventory_area');
            $table->string('output_unit', 16)->nullable()->default('kg')->after('output_tinta_subarea');
        });

        Schema::table('tinta_mixtures', function (Blueprint $table) {
            $table->foreignId('output_material_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('tinta_mixtures', function (Blueprint $table) {
            $table->dropForeign(['material_request_id']);
            $table->dropColumn([
                'status',
                'material_request_id',
                'output_sku',
                'output_name',
                'output_inventory_area',
                'output_tinta_subarea',
                'output_unit',
            ]);
        });
    }
};
