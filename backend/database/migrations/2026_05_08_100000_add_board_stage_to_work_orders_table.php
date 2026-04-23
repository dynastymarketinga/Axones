<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->string('board_stage', 32)->default('nueva')->index()->after('scheduling_status');
        });

        DB::table('work_orders')->where('scheduling_status', 'pending_programming')->update(['board_stage' => 'nueva']);
        DB::table('work_orders')->where('scheduling_status', 'in_programming')->update(['board_stage' => 'pendiente']);
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropColumn('board_stage');
        });
    }
};
