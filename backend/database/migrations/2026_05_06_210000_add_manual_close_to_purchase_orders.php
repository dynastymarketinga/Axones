<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('purchase_orders', 'manually_closed_at')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->timestamp('manually_closed_at')->nullable()->after('notes');
            });
        }

        if (! Schema::hasColumn('purchase_orders', 'manually_closed_by')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->foreignId('manually_closed_by')
                    ->nullable()
                    ->after('manually_closed_at')
                    ->constrained('users')
                    ->nullOnDelete();
            });
        }

        if (! Schema::hasColumn('purchase_orders', 'manual_close_reason')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->text('manual_close_reason')->nullable()->after('manually_closed_by');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('purchase_orders', 'manual_close_reason')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->dropColumn('manual_close_reason');
            });
        }

        if (Schema::hasColumn('purchase_orders', 'manually_closed_by')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->dropConstrainedForeignId('manually_closed_by');
            });
        }

        if (Schema::hasColumn('purchase_orders', 'manually_closed_at')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->dropColumn('manually_closed_at');
            });
        }
    }
};
