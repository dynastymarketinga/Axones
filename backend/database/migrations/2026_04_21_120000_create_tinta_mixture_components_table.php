<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tinta_mixture_components', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tinta_mixture_id')->constrained('tinta_mixtures')->cascadeOnDelete();
            $table->foreignId('material_id')->constrained('materials')->restrictOnDelete();
            $table->decimal('quantity', 15, 3);
            $table->timestamps();

            $table->unique(['tinta_mixture_id', 'material_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tinta_mixture_components');
    }
};
