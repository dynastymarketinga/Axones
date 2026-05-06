<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->boolean('tax_applies')->default(true)->after('notes');
        });

        Schema::table('purchase_order_lines', function (Blueprint $table) {
            $table->decimal('unit_price', 15, 4)->default(0)->after('unit');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn('tax_applies');
        });

        Schema::table('purchase_order_lines', function (Blueprint $table) {
            $table->dropColumn('unit_price');
        });
    }
};
