<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->text('address')->nullable()->after('city');
        });

        Schema::table('delivery_notes', function (Blueprint $table) {
            $table->unsignedInteger('sequential_number')->nullable()->unique()->after('id');
            $table->foreignId('work_order_id')->nullable()->after('code')->constrained('work_orders')->nullOnDelete();
            $table->date('document_date')->nullable()->after('work_order_id');
        });

        Schema::table('delivery_note_lines', function (Blueprint $table) {
            $table->unsignedInteger('bobbin_count')->default(1)->after('pallet_code');
        });
    }

    public function down(): void
    {
        Schema::table('delivery_note_lines', function (Blueprint $table) {
            $table->dropColumn('bobbin_count');
        });

        Schema::table('delivery_notes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('work_order_id');
            $table->dropColumn(['document_date', 'sequential_number']);
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn('address');
        });
    }
};
