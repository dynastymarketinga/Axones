<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_receipt_lines', function (Blueprint $table) {
            $table->unsignedInteger('bobina_count')->nullable()->after('quantity');
            $table->decimal('bobina_weight_kg', 15, 3)->nullable()->after('bobina_count');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_receipt_lines', function (Blueprint $table) {
            $table->dropColumn(['bobina_count', 'bobina_weight_kg']);
        });
    }
};

