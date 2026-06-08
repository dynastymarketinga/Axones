<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('vendors') || ! Schema::hasColumn('vendors', 'phone')) {
            return;
        }

        // Preservar datos legacy antes de eliminar la columna.
        if (Schema::hasColumn('vendors', 'phone_primary')) {
            DB::statement("
                UPDATE vendors
                SET phone_primary = phone
                WHERE (phone_primary IS NULL OR phone_primary = '')
                  AND phone IS NOT NULL
                  AND phone <> ''
            ");
        }

        Schema::table('vendors', function (Blueprint $table) {
            $table->dropColumn('phone');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('vendors') || Schema::hasColumn('vendors', 'phone')) {
            return;
        }

        Schema::table('vendors', function (Blueprint $table) {
            $table->string('phone', 64)->nullable()->after('phone_secondary');
        });

        if (Schema::hasColumn('vendors', 'phone_primary')) {
            DB::statement("
                UPDATE vendors
                SET phone = phone_primary
                WHERE phone_primary IS NOT NULL
                  AND phone_primary <> ''
            ");
        }
    }
};
