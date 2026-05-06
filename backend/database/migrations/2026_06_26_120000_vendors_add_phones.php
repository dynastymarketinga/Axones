<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('vendors')) {
            return;
        }

        Schema::table('vendors', function (Blueprint $table) {
            if (! Schema::hasColumn('vendors', 'phone_primary')) {
                $table->string('phone_primary', 64)->nullable()->after('name');
            }
            if (! Schema::hasColumn('vendors', 'phone_secondary')) {
                $table->string('phone_secondary', 64)->nullable()->after('phone_primary');
            }
        });

        // Migrar datos existentes: `phone` -> `phone_primary` si no hay principal aún.
        if (Schema::hasColumn('vendors', 'phone')) {
            DB::statement("
                UPDATE vendors
                SET phone_primary = phone
                WHERE (phone_primary IS NULL OR phone_primary = '')
                  AND phone IS NOT NULL
                  AND phone <> ''
            ");
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('vendors')) {
            return;
        }

        Schema::table('vendors', function (Blueprint $table) {
            if (Schema::hasColumn('vendors', 'phone_secondary')) {
                $table->dropColumn('phone_secondary');
            }
            if (Schema::hasColumn('vendors', 'phone_primary')) {
                $table->dropColumn('phone_primary');
            }
        });
    }
};

