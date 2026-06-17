<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\AxonesUserCredentials;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class ResetUserCredentialsCommand extends Command
{
    protected $signature = 'axones:users:reset-credentials';

    protected $description = 'Migra correos a @axones.com, resetea contraseñas (Axones2026!{usuario}) y genera CSV de credenciales.';

    public function handle(): int
    {
        $rows = [];
        $emailMigrated = 0;
        $passwordReset = 0;

        $users = User::query()->orderBy('name')->get();

        foreach ($users as $user) {
            $username = trim((string) ($user->username ?? ''));
            if ($username === '') {
                $this->warn("Usuario id {$user->id} sin username; omitido.");

                continue;
            }

            $currentEmail = strtolower(trim((string) $user->email));
            $newEmail = $currentEmail === strtolower(AxonesUserCredentials::VICTOR_EMAIL)
                ? $user->email
                : AxonesUserCredentials::migrateEmailFromLegacy((string) $user->email);

            if ($newEmail !== $user->email) {
                $user->email = $newEmail;
                $emailMigrated++;
            }

            $plainPassword = AxonesUserCredentials::passwordForUsername($username);
            $user->password = Hash::make($plainPassword);
            $user->save();
            $user->tokens()->delete();
            $passwordReset++;

            $rows[] = [
                'nombre' => (string) $user->name,
                'usuario' => $username,
                'correo' => (string) $user->email,
                'rol' => (string) ($user->role ?? ''),
                'contraseña' => $plainPassword,
            ];
        }

        usort($rows, static fn (array $a, array $b): int => strcasecmp($a['nombre'], $b['nombre']));

        $csv = $this->buildCsv($rows);
        $path = 'credenciales-usuarios-axones.csv';
        Storage::disk('local')->put($path, $csv);
        $absolutePath = Storage::disk('local')->path($path);

        $this->info('Credenciales actualizadas.');
        $this->line("  Correos migrados a @axones.com: {$emailMigrated}");
        $this->line("  Contraseñas reseteadas: {$passwordReset}");
        $this->newLine();
        $this->info("CSV: {$absolutePath}");
        $this->newLine();
        $this->table(
            ['Nombre', 'Usuario', 'Correo', 'Rol', 'Contraseña'],
            array_map(
                static fn (array $r): array => [$r['nombre'], $r['usuario'], $r['correo'], $r['rol'], $r['contraseña']],
                $rows,
            ),
        );

        return self::SUCCESS;
    }

    /**
     * @param  list<array{nombre: string, usuario: string, correo: string, rol: string, contraseña: string}>  $rows
     */
    private function buildCsv(array $rows): string
    {
        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            return '';
        }

        fputcsv($handle, ['nombre', 'usuario', 'correo', 'rol', 'contraseña']);
        foreach ($rows as $row) {
            fputcsv($handle, [$row['nombre'], $row['usuario'], $row['correo'], $row['rol'], $row['contraseña']]);
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return $csv !== false ? $csv : '';
    }
}
