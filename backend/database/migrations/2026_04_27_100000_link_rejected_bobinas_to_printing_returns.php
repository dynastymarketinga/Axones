<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_returns', function (Blueprint $table) {
            $table->foreignId('work_order_id')->nullable()->constrained('work_orders')->restrictOnDelete();
        });

        Schema::table('bobinas', function (Blueprint $table) {
            $table->foreignId('inventory_return_id')->nullable()->unique()->constrained('inventory_returns')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('bobinas', function (Blueprint $table) {
            $table->dropConstrainedForeignId('inventory_return_id');
        });

        Schema::table('inventory_returns', function (Blueprint $table) {
            $table->dropConstrainedForeignId('work_order_id');
        });
    }
};
