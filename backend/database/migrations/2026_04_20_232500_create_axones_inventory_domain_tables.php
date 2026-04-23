<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('materials', function (Blueprint $table) {
            $table->id();
            $table->string('sku')->unique();
            $table->string('name');
            $table->string('barcode')->nullable()->index();
            $table->string('inventory_area', 32)->index();
            $table->string('tinta_presentacion', 16)->nullable();
            $table->string('unit', 16)->default('kg');
            $table->decimal('min_stock', 15, 3)->default(0);
            $table->decimal('quantity_on_hand', 15, 3)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_id')->constrained('materials')->cascadeOnDelete();
            $table->string('movement_type', 24);
            $table->decimal('quantity', 15, 3);
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at')->useCurrent();
            $table->timestamps();
            $table->index(['reference_type', 'reference_id']);
        });

        Schema::create('inventory_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_id')->nullable()->constrained('materials')->nullOnDelete();
            $table->string('destination_area', 32)->index();
            $table->decimal('quantity', 15, 3);
            $table->string('status', 16)->default('pending')->index();
            $table->text('reason')->nullable();
            $table->foreignId('accepted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('tinta_mixtures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('output_material_id')->constrained('materials')->cascadeOnDelete();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('bobinas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_id')->constrained('materials')->cascadeOnDelete();
            $table->string('code')->unique();
            $table->decimal('weight_kg', 15, 3);
            $table->string('status', 16)->default('available')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bobinas');
        Schema::dropIfExists('tinta_mixtures');
        Schema::dropIfExists('inventory_returns');
        Schema::dropIfExists('inventory_movements');
        Schema::dropIfExists('materials');
    }
};
