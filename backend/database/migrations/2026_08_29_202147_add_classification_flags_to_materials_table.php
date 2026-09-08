<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('materials', function (Blueprint $table) {
            // Agregamos los 3 checks (booleanos) justo después de inventory_area
            $table->boolean('is_imprimir')->default(false)->after('inventory_area');
            $table->boolean('is_laminar')->default(false)->after('is_imprimir');
            $table->boolean('is_trilaminar')->default(false)->after('is_laminar');
        });
    }

    public function down()
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->dropColumn(['is_imprimir', 'is_laminar', 'is_trilaminar']);
        });
    }
};