<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $rows = DB::table('users')->select('id', 'email', 'username')->orderBy('id')->get();

        foreach ($rows as $row) {
            $current = trim((string) ($row->username ?? ''));
            if ($current !== '') {
                continue;
            }

            $email = strtolower(trim((string) ($row->email ?? '')));
            $base = strstr($email, '@', true) ?: ('user'.$row->id);
            $base = preg_replace('/[^a-z0-9_.-]/', '', $base) ?: ('user'.$row->id);

            $candidate = $base;
            $i = 2;
            while (
                DB::table('users')
                    ->where('username', $candidate)
                    ->where('id', '!=', $row->id)
                    ->exists()
            ) {
                $candidate = $base.'_'.$i;
                $i++;
            }

            DB::table('users')->where('id', $row->id)->update(['username' => $candidate]);
        }
    }

    public function down(): void
    {
        // No reversible sin perder datos válidos.
    }
};
