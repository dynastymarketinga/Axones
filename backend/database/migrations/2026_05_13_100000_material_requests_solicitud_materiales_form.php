<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('material_requests', function (Blueprint $table) {
            $table->date('document_date')->nullable()->after('work_order_id');
            $table->json('destination_areas')->nullable()->after('originating_area');
            $table->string('machine_code', 64)->nullable()->after('destination_areas');
            $table->foreignId('authorized_by')->nullable()->after('requested_by')->constrained('users')->nullOnDelete();
            $table->timestamp('authorized_at')->nullable()->after('authorized_by');
            $table->foreignId('dispatched_by')->nullable()->after('authorized_at')->constrained('users')->nullOnDelete();
            $table->timestamp('dispatched_at')->nullable()->after('dispatched_by');
        });

        Schema::table('material_request_lines', function (Blueprint $table) {
            $table->dropForeign(['material_id']);
        });

        Schema::table('material_request_lines', function (Blueprint $table) {
            $table->unsignedBigInteger('material_id')->nullable()->change();
            $table->text('description')->nullable()->after('material_id');
            $table->string('unit', 16)->nullable()->after('quantity_requested');
        });

        Schema::table('material_request_lines', function (Blueprint $table) {
            $table->foreign('material_id')->references('id')->on('materials')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('material_request_lines', function (Blueprint $table) {
            $table->dropForeign(['material_id']);
        });

        Schema::table('material_request_lines', function (Blueprint $table) {
            $table->dropColumn(['description', 'unit']);
            $table->unsignedBigInteger('material_id')->nullable(false)->change();
        });

        Schema::table('material_request_lines', function (Blueprint $table) {
            $table->foreign('material_id')->references('id')->on('materials')->restrictOnDelete();
        });

        Schema::table('material_requests', function (Blueprint $table) {
            $table->dropForeign(['authorized_by']);
            $table->dropForeign(['dispatched_by']);
            $table->dropColumn([
                'document_date',
                'destination_areas',
                'machine_code',
                'authorized_by',
                'authorized_at',
                'dispatched_by',
                'dispatched_at',
            ]);
        });
    }
};
