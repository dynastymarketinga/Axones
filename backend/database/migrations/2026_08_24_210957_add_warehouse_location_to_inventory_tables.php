<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            // Agregamos el campo para indicar el almacén principal del material
            $table->string('warehouse_location', 50)->nullable()->after('inventory_area');
        });

        Schema::table('inventory_movements', function (Blueprint $table) {
            // Agregamos el campo para saber en qué almacén ocurrió el movimiento
            $table->string('warehouse_location', 50)->nullable()->after('movement_type');
        });
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->dropColumn('warehouse_location');
        });

        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->dropColumn('warehouse_location');
        });
    }
};