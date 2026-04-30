<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tinta_subareas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_id')->constrained('materials')->cascadeOnDelete();
            $table->string('subarea', 32);
            $table->timestamps();

            $table->unique(['material_id', 'subarea'], 'tinta_subareas_material_subarea_unique');
            $table->index('subarea');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tinta_subareas');
    }
};
