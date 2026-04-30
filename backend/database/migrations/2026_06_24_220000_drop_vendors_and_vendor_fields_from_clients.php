<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('clients', 'vendor_id')) {
            if (DB::connection()->getDriverName() === 'sqlite') {
                DB::statement('DROP INDEX IF EXISTS clients_vendor_id_index');
            }
            Schema::table('clients', function (Blueprint $table) {
                $table->dropConstrainedForeignId('vendor_id');
            });
        }

        if (Schema::hasColumn('clients', 'vendor_name')) {
            Schema::table('clients', function (Blueprint $table) {
                $table->dropColumn('vendor_name');
            });
        }

        Schema::dropIfExists('vendors');
    }

    public function down(): void
    {
        if (! Schema::hasTable('vendors')) {
            Schema::create('vendors', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->boolean('active')->default(true)->index();
                $table->timestamps();
            });
        }

        if (! Schema::hasColumn('clients', 'vendor_name')) {
            Schema::table('clients', function (Blueprint $table) {
                $table->string('vendor_name')->nullable()->after('city');
            });
        }

        if (! Schema::hasColumn('clients', 'vendor_id')) {
            Schema::table('clients', function (Blueprint $table) {
                $table->foreignId('vendor_id')
                    ->nullable()
                    ->after('city')
                    ->constrained('vendors')
                    ->nullOnDelete();
                $table->index('vendor_id');
            });
        }
    }
};
