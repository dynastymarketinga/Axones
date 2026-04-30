<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('materials', 'is_active')) {
            Schema::table('materials', function (Blueprint $table) {
                $table->dropColumn('is_active');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('materials', 'is_active')) {
            Schema::table('materials', function (Blueprint $table) {
                $table->boolean('is_active')->default(true)->index();
            });
        }
    }
};
