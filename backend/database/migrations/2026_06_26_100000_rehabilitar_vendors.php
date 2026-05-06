<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('vendors')) {
            Schema::create('vendors', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->string('phone', 64)->nullable();
                $table->boolean('active')->default(true)->index();
                $table->timestamps();
            });
        } else {
            // Si la tabla existe por algún motivo, asegurar columnas mínimas.
            Schema::table('vendors', function (Blueprint $table) {
                if (! Schema::hasColumn('vendors', 'phone')) {
                    $table->string('phone', 64)->nullable()->after('name');
                }
                if (! Schema::hasColumn('vendors', 'active')) {
                    $table->boolean('active')->default(true)->index()->after('phone');
                }
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

    public function down(): void
    {
        if (Schema::hasColumn('clients', 'vendor_id')) {
            Schema::table('clients', function (Blueprint $table) {
                $table->dropConstrainedForeignId('vendor_id');
            });
        }

        Schema::dropIfExists('vendors');
    }
};

