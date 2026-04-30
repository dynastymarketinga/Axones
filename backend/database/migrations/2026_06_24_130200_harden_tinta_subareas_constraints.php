<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('tinta_subareas')) {
            return;
        }

        $driver = DB::connection()->getDriverName();
        $allowed = ['laminacion', 'superficie', 'prueba_laminacion', 'laminacion_nueva'];

        // Normaliza cualquier valor legacy fuera de catálogo.
        DB::table('tinta_subareas')
            ->whereNotIn('subarea', $allowed)
            ->update(['subarea' => 'superficie', 'updated_at' => now()]);

        // Garantiza 1 sola subárea por material (conserva la fila más reciente por material).
        $keepIds = DB::table('tinta_subareas')
            ->selectRaw('MAX(id) as id')
            ->groupBy('material_id')
            ->pluck('id')
            ->all();
        if ($keepIds !== []) {
            DB::table('tinta_subareas')->whereNotIn('id', $keepIds)->delete();
        }

        Schema::table('tinta_subareas', function (Blueprint $table) {
            $table->index('material_id', 'tinta_subareas_material_id_tmp_index');
        });

        try {
            Schema::table('tinta_subareas', function (Blueprint $table) {
                $table->dropUnique('tinta_subareas_material_subarea_unique');
            });
        } catch (Throwable) {
            // Compatibilidad con esquemas donde el índice legacy no existe.
        }

        try {
            Schema::table('tinta_subareas', function (Blueprint $table) {
                $table->unique('material_id', 'tinta_subareas_material_unique');
            });
        } catch (Throwable) {
            // Compatibilidad con esquemas donde el índice nuevo ya existe.
        }

        Schema::table('tinta_subareas', function (Blueprint $table) {
            $table->dropIndex('tinta_subareas_material_id_tmp_index');
        });

        if ($driver === 'mysql') {
            try {
                DB::statement("
                    ALTER TABLE tinta_subareas
                    ADD CONSTRAINT chk_tinta_subareas_subarea_valid
                    CHECK (subarea IN ('laminacion', 'superficie', 'prueba_laminacion', 'laminacion_nueva'))
                ");
            } catch (Throwable) {
                // Compatibilidad con motores/estados donde el check ya existe.
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('tinta_subareas')) {
            return;
        }

        $driver = DB::connection()->getDriverName();
        if ($driver === 'mysql') {
            try {
                DB::statement('ALTER TABLE tinta_subareas DROP CHECK chk_tinta_subareas_subarea_valid');
            } catch (Throwable) {
                // Compatibilidad con motores/estados donde el check no existe.
            }
        }

        try {
            Schema::table('tinta_subareas', function (Blueprint $table) {
                $table->dropUnique('tinta_subareas_material_unique');
            });
        } catch (Throwable) {
            // Compatibilidad con esquemas donde el índice nuevo no existe.
        }

        try {
            Schema::table('tinta_subareas', function (Blueprint $table) {
                $table->unique(['material_id', 'subarea'], 'tinta_subareas_material_subarea_unique');
            });
        } catch (Throwable) {
            // Compatibilidad con esquemas donde el índice legacy ya existe.
        }
    }
};
