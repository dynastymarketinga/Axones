<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('area_requests', function (Blueprint $table) {
            $table->foreignId('material_request_id')
                ->nullable()
                ->after('work_order_id')
                ->constrained('material_requests')
                ->cascadeOnDelete();
        });

        Schema::table('area_requests', function (Blueprint $table) {
            $table->unique('material_request_id');
        });
    }

    public function down(): void
    {
        Schema::table('area_requests', function (Blueprint $table) {
            $table->dropUnique(['material_request_id']);
        });

        Schema::table('area_requests', function (Blueprint $table) {
            $table->dropForeign(['material_request_id']);
            $table->dropColumn('material_request_id');
        });
    }
};
