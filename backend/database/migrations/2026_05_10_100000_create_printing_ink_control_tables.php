<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('printing_ink_control_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
            $table->foreignId('material_id')->constrained('materials')->restrictOnDelete();
            $table->unsignedSmallInteger('position')->default(0)->index();
            $table->decimal('quantity_original_kg', 15, 3)->default(0);
            $table->decimal('quantity_solventada_kg', 15, 3)->default(0);
            $table->decimal('quantity_return_kg', 15, 3)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('printing_chemical_usages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
            $table->string('chemical_type', 24)->index();
            $table->decimal('quantity_loaded_kg', 15, 3)->default(0);
            $table->decimal('quantity_return_kg', 15, 3)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['work_order_id', 'chemical_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('printing_chemical_usages');
        Schema::dropIfExists('printing_ink_control_lines');
    }
};
