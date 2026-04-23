<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->string('document_number', 32)->nullable()->unique()->after('code');
            $table->date('document_date')->nullable()->after('document_number');
            $table->string('issued_to', 128)->default('JEFE DE PRODUCCIÓN')->after('document_date');
            $table->string('issued_from', 128)->default('GERENCIA')->after('issued_to');
            $table->string('authorized_by_name', 128)->nullable()->after('issued_from');
            $table->string('authorized_by_title', 128)->nullable()->after('authorized_by_name');
        });

        Schema::create('work_order_production_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(0)->index();
            $table->decimal('quantity', 15, 3);
            $table->string('quantity_unit', 16)->default('Kg');
            $table->string('product_description');
            $table->text('technical_specs')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_order_production_items');

        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropColumn([
                'document_number',
                'document_date',
                'issued_to',
                'issued_from',
                'authorized_by_name',
                'authorized_by_title',
            ]);
        });
    }
};
