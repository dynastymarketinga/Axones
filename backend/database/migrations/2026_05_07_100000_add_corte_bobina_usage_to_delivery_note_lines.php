<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_note_lines', function (Blueprint $table) {
            $table->foreignId('corte_bobina_usage_id')
                ->nullable()
                ->after('delivery_note_id')
                ->constrained('corte_bobina_usages')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('delivery_note_lines', function (Blueprint $table) {
            $table->dropConstrainedForeignId('corte_bobina_usage_id');
        });
    }
};
