<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $map = [
            'original' => 'superficie',
            'solventada' => 'laminacion',
            'superficie' => 'superficie',
            'laminacion' => 'laminacion',
            'prueba_laminacion' => 'prueba_laminacion',
            'laminacion_nueva' => 'laminacion_nueva',
        ];

        DB::table('materials')
            ->select(['id', 'inventory_area', 'tinta_presentacion'])
            ->orderBy('id')
            ->chunkById(200, function ($rows) use ($map): void {
                foreach ($rows as $row) {
                    if (($row->inventory_area ?? null) !== 'tintas') {
                        continue;
                    }

                    $legacy = mb_strtolower(trim((string) ($row->tinta_presentacion ?? '')));
                    if ($legacy === '') {
                        continue;
                    }

                    $subarea = $map[$legacy] ?? null;
                    if (! is_string($subarea) || $subarea === '') {
                        continue;
                    }

                    DB::table('tinta_subareas')->updateOrInsert(
                        ['material_id' => (int) $row->id],
                        ['subarea' => $subarea, 'updated_at' => now(), 'created_at' => now()],
                    );
                }
            });
    }

    public function down(): void
    {
        // Backfill irreversible: no-op.
    }
};
