<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tinta_mixtures', function (Blueprint $table) {
            $table->foreignId('work_order_id')
                ->nullable()
                ->after('output_material_id')
                ->constrained('work_orders')
                ->nullOnDelete()
                ->index();
        });
    }

    public function down(): void
    {
        Schema::table('tinta_mixtures', function (Blueprint $table) {
            $table->dropConstrainedForeignId('work_order_id');
        });
    }
};

