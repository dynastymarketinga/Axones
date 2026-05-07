<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('purchase_orders', 'is_active')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->boolean('is_active')->default(true);
            });
        }

        if (! Schema::hasColumn('purchase_orders', 'deactivated_at')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->timestamp('deactivated_at')->nullable();
            });
        }

        if (! Schema::hasColumn('purchase_orders', 'deactivation_reason')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->text('deactivation_reason')->nullable();
            });
        }

        if (! Schema::hasColumn('purchase_orders', 'last_change_reason')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->text('last_change_reason')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('purchase_orders', 'last_change_reason')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->dropColumn('last_change_reason');
            });
        }

        if (Schema::hasColumn('purchase_orders', 'deactivation_reason')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->dropColumn('deactivation_reason');
            });
        }

        if (Schema::hasColumn('purchase_orders', 'deactivated_at')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->dropColumn('deactivated_at');
            });
        }

        if (Schema::hasColumn('purchase_orders', 'is_active')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->dropColumn('is_active');
            });
        }
    }
};
