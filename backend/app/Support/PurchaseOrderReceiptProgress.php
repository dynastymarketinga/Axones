<?php

namespace App\Support;

use Illuminate\Support\Collection;

final class PurchaseOrderReceiptProgress
{
    /**
     * Etiqueta compacta para listado: "400,000 / 500,000 kg" o "1 línea pendiente".
     *
     * @param  Collection<int, object{quantity_ordered: string|float, quantity_received: string|float, unit: ?string}>  $lines
     */
    public static function label(Collection $lines): ?string
    {
        if ($lines->isEmpty()) {
            return null;
        }

        $units = $lines
            ->map(static fn ($line) => strtolower(trim((string) ($line->unit ?? 'kg'))))
            ->filter(static fn (string $u): bool => $u !== '')
            ->unique()
            ->values();

        if ($units->count() === 1) {
            $unit = (string) $units->first();
            $ordered = '0';
            $received = '0';
            foreach ($lines as $line) {
                $ordered = bcadd($ordered, (string) $line->quantity_ordered, 3);
                $received = bcadd($received, (string) $line->quantity_received, 3);
            }

            return self::formatPair($received, $ordered, $unit);
        }

        $pendingCount = $lines->filter(static function ($line): bool {
            return bccomp((string) $line->quantity_received, (string) $line->quantity_ordered, 3) === -1;
        })->count();

        if ($pendingCount === 0) {
            return 'Completo';
        }

        return $pendingCount === 1
            ? '1 línea pendiente'
            : "{$pendingCount} líneas pendientes";
    }

    private static function formatPair(string $received, string $ordered, string $unit): string
    {
        return self::formatQty($received).' / '.self::formatQty($ordered).' '.$unit;
    }

    private static function formatQty(string $value): string
    {
        $n = (float) $value;

        return number_format($n, 3, ',', '.');
    }
}
