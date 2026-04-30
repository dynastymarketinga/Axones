<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('materials', 'micras')) {
            Schema::table('materials', function (Blueprint $table) {
                if (Schema::hasColumn('materials', 'tinta_presentacion')) {
                    $table->decimal('micras', 10, 3)->nullable()->after('tinta_presentacion');
                } else {
                    $table->decimal('micras', 10, 3)->nullable();
                }
            });
        }

        if (! Schema::hasColumn('materials', 'ancho')) {
            Schema::table('materials', function (Blueprint $table) {
                $table->decimal('ancho', 10, 3)->nullable()->after('micras');
            });
        }
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $drop = [];
            if (Schema::hasColumn('materials', 'micras')) {
                $drop[] = 'micras';
            }
            if (Schema::hasColumn('materials', 'ancho')) {
                $drop[] = 'ancho';
            }
            if ($drop !== []) {
                $table->dropColumn($drop);
            }
        });
    }
};
