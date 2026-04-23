<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_order_lines', function (Blueprint $table) {
            $table->foreignId('material_id')->nullable()->after('product_id')->constrained('materials')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('client_order_lines', function (Blueprint $table) {
            $table->dropConstrainedForeignId('material_id');
        });
    }
};
