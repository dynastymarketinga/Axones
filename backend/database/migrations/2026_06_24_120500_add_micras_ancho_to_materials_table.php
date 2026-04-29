<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->decimal('micras', 10, 3)->nullable()->after('tinta_presentacion');
            $table->decimal('ancho', 10, 3)->nullable()->after('micras');
        });
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->dropColumn(['micras', 'ancho']);
        });
    }
};
