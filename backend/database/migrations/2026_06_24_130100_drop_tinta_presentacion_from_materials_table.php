<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            if (Schema::hasColumn('materials', 'tinta_presentacion')) {
                $table->dropColumn('tinta_presentacion');
            }
        });
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            if (! Schema::hasColumn('materials', 'tinta_presentacion')) {
                $table->string('tinta_presentacion', 16)->nullable()->after('inventory_area');
            }
        });
    }
};
