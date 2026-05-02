<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('UPDATE clients SET phone = LEFT(phone, 22) WHERE phone IS NOT NULL AND CHAR_LENGTH(phone) > 22');
        } else {
            DB::statement('UPDATE clients SET phone = substr(phone, 1, 22) WHERE phone IS NOT NULL AND length(phone) > 22');
        }

        if (Schema::hasColumn('clients', 'vendor_id')) {
            Schema::disableForeignKeyConstraints();
            try {
                try {
                    Schema::table('clients', function (Blueprint $table) {
                        $table->dropForeign(['vendor_id']);
                    });
                } catch (Throwable) {
                }
                if (Schema::hasColumn('clients', 'vendor_id')) {
                    Schema::table('clients', function (Blueprint $table) {
                        $table->dropColumn('vendor_id');
                    });
                }
            } finally {
                Schema::enableForeignKeyConstraints();
            }
        }

        if (Schema::hasColumn('clients', 'vendor_name')) {
            Schema::table('clients', function (Blueprint $table) {
                $table->dropColumn('vendor_name');
            });
        }

        Schema::table('clients', function (Blueprint $table) {
            $table->string('phone', 22)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('phone')->nullable()->change();
        });

        if (! Schema::hasColumn('clients', 'vendor_name')) {
            Schema::table('clients', function (Blueprint $table) {
                $table->string('vendor_name')->nullable()->after('address');
            });
        }

        if (! Schema::hasColumn('clients', 'vendor_id')) {
            Schema::table('clients', function (Blueprint $table) {
                $table->unsignedBigInteger('vendor_id')->nullable()->after('city');
                $table->index('vendor_id');
            });
        }
    }
};
