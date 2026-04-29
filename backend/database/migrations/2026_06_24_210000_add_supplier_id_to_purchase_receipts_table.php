<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_receipts', function (Blueprint $table): void {
            $table->foreignId('supplier_id')
                ->nullable()
                ->after('purchase_order_id')
                ->constrained('suppliers')
                ->nullOnDelete();
        });

        $suppliers = DB::table('suppliers')
            ->select(['id', 'name'])
            ->get()
            ->mapWithKeys(function ($row): array {
                $key = mb_strtolower(trim((string) $row->name));
                return $key !== '' ? [$key => (int) $row->id] : [];
            });

        DB::table('purchase_receipts')
            ->select(['id', 'supplier_name', 'purchase_order_id', 'supplier_id'])
            ->orderBy('id')
            ->chunkById(500, function ($rows) use ($suppliers): void {
                foreach ($rows as $row) {
                    if ($row->supplier_id !== null) {
                        continue;
                    }

                    $resolvedSupplierId = null;
                    $nameKey = mb_strtolower(trim((string) ($row->supplier_name ?? '')));
                    if ($nameKey !== '' && $suppliers->has($nameKey)) {
                        $resolvedSupplierId = (int) $suppliers->get($nameKey);
                    }

                    if ($resolvedSupplierId === null && $row->purchase_order_id !== null) {
                        $resolvedSupplierId = DB::table('purchase_orders')
                            ->where('id', (int) $row->purchase_order_id)
                            ->value('supplier_id');
                        $resolvedSupplierId = $resolvedSupplierId !== null ? (int) $resolvedSupplierId : null;
                    }

                    if ($resolvedSupplierId !== null) {
                        DB::table('purchase_receipts')
                            ->where('id', (int) $row->id)
                            ->update(['supplier_id' => $resolvedSupplierId]);
                    }
                }
            });
    }

    public function down(): void
    {
        Schema::table('purchase_receipts', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('supplier_id');
        });
    }
};

