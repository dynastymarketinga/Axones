<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('purchase_orders')
            ->where('status', 'cancelled')
            ->update(['status' => 'completed']);
    }

    public function down(): void
    {
        // No se puede distinguir qué filas en `completed` provenían de `cancelled`.
    }
};
