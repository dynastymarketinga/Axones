<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('material_requests', function (Blueprint $table) {
            $table->dropForeign(['work_order_id']);
        });

        Schema::table('material_requests', function (Blueprint $table) {
            $table->unsignedBigInteger('work_order_id')->nullable()->change();
        });

        Schema::table('material_requests', function (Blueprint $table) {
            $table->foreign('work_order_id')
                ->references('id')
                ->on('work_orders')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('material_requests', function (Blueprint $table) {
            $table->dropForeign(['work_order_id']);
        });

        Schema::table('material_requests', function (Blueprint $table) {
            $table->unsignedBigInteger('work_order_id')->nullable(false)->change();
        });

        Schema::table('material_requests', function (Blueprint $table) {
            $table->foreign('work_order_id')
                ->references('id')
                ->on('work_orders')
                ->restrictOnDelete();
        });
    }
};
