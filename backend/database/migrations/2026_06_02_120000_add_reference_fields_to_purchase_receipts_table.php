<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_receipts', function (Blueprint $table): void {
            $table->string('supplier_name', 191)->nullable()->after('purchase_order_id');
            $table->string('invoice_number', 191)->nullable()->after('supplier_name');
            $table->string('purchase_order_reference', 191)->nullable()->after('invoice_number');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_receipts', function (Blueprint $table): void {
            $table->dropColumn(['supplier_name', 'invoice_number', 'purchase_order_reference']);
        });
    }
};
