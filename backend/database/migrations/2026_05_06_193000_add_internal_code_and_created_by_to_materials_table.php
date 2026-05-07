<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('materials', 'internal_code')) {
            Schema::table('materials', function (Blueprint $table) {
                $table->string('internal_code', 64)->nullable()->after('sku');
            });
        }

        if (! Schema::hasColumn('materials', 'created_by_user_id')) {
            Schema::table('materials', function (Blueprint $table) {
                $table->foreignId('created_by_user_id')
                    ->nullable()
                    ->after('internal_code')
                    ->constrained('users')
                    ->nullOnDelete();
            });
        }

        $existing = DB::table('materials')->whereNull('internal_code')->get(['id', 'sku']);
        $taken = DB::table('materials')->whereNotNull('internal_code')->pluck('internal_code')->all();
        $taken = array_flip($taken);

        foreach ($existing as $row) {
            $code = $this->buildCandidate((string) $row->sku, $taken);
            $taken[$code] = true;
            DB::table('materials')->where('id', $row->id)->update(['internal_code' => $code]);
        }

        if (! $this->hasUniqueIndex('materials', 'materials_internal_code_unique')) {
            Schema::table('materials', function (Blueprint $table) {
                $table->unique('internal_code');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('materials', 'created_by_user_id')) {
            Schema::table('materials', function (Blueprint $table) {
                $table->dropConstrainedForeignId('created_by_user_id');
            });
        }

        if (Schema::hasColumn('materials', 'internal_code')) {
            Schema::table('materials', function (Blueprint $table) {
                if ($this->hasUniqueIndex('materials', 'materials_internal_code_unique')) {
                    $table->dropUnique('materials_internal_code_unique');
                }
                $table->dropColumn('internal_code');
            });
        }
    }

    /**
     * @param  array<string,bool>  $taken
     */
    private function buildCandidate(string $sku, array $taken): string
    {
        $base = mb_strtoupper(Str::slug(trim($sku) !== '' ? $sku : 'MAT', '-'));
        if ($base === '') {
            $base = 'MAT';
        }

        for ($i = 0; $i < 20; $i++) {
            $candidate = mb_substr($base, 0, 50).'-'.mb_strtoupper(Str::random(5));
            if (! isset($taken[$candidate])) {
                return $candidate;
            }
        }

        return mb_substr($base, 0, 40).'-'.mb_strtoupper(Str::random(10));
    }

    private function hasUniqueIndex(string $table, string $indexName): bool
    {
        try {
            $rows = DB::select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$indexName]);

            return count($rows) > 0;
        } catch (Throwable) {
            return false;
        }
    }
};
