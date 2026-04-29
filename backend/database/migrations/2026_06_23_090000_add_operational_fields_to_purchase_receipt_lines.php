<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_receipt_lines', function (Blueprint $table): void {
            $table->string('item_type', 24)->nullable()->after('material_id');
            $table->string('unit', 16)->nullable()->after('quantity');
            $table->decimal('micras', 10, 3)->nullable()->after('unit');
            $table->decimal('ancho_mm', 10, 3)->nullable()->after('micras');

            $table->index(['item_type', 'micras', 'ancho_mm'], 'pr_lines_type_dims_idx');
            $table->index(['material_id', 'item_type'], 'pr_lines_material_type_idx');
            $table->index('unit', 'pr_lines_unit_idx');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_receipt_lines', function (Blueprint $table): void {
            $table->dropIndex('pr_lines_type_dims_idx');
            $table->dropIndex('pr_lines_material_type_idx');
            $table->dropIndex('pr_lines_unit_idx');
            $table->dropColumn(['item_type', 'unit', 'micras', 'ancho_mm']);
        });
    }
};
