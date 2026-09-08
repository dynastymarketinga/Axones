<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_order_lines', function (Blueprint $table) {
            $table->foreignId('material_imprimir_id')->nullable()->constrained('materials')->nullOnDelete();
            $table->foreignId('material_laminar_id')->nullable()->constrained('materials')->nullOnDelete();
            $table->foreignId('material_trilaminar_id')->nullable()->constrained('materials')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('client_order_lines', function (Blueprint $table) {
            $table->dropForeign(['material_imprimir_id']);
            $table->dropForeign(['material_laminar_id']);
            $table->dropForeign(['material_trilaminar_id']);
            $table->dropColumn(['material_imprimir_id', 'material_laminar_id', 'material_trilaminar_id']);
        });
    }
};