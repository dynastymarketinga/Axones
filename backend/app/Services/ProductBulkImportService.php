<?php

namespace App\Services;

use App\Models\Client;
use App\Models\Product;
use App\Support\RifNormalizer;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProductBulkImportService
{
    /**
     * @param  list<array<string, mixed>>  $clients
     * @param  list<array<string, mixed>>  $products
     * @return array<string, mixed>
     */
    public function import(array $clients, array $products, bool $dryRun = false, ?string $sourceFilename = null): array
    {
        $clientsCreated = 0;
        $clientsUpdated = 0;
        $productsCreated = 0;
        $productsUpdated = 0;
        $unchanged = 0;
        $errors = [];

        $clientIdByKey = [];

        $work = function () use (
            $clients,
            $products,
            $dryRun,
            &$clientsCreated,
            &$clientsUpdated,
            &$productsCreated,
            &$productsUpdated,
            &$unchanged,
            &$errors,
            &$clientIdByKey
        ): void {
            foreach ($this->dedupeClients($clients) as $index => $row) {
                try {
                    $result = $this->upsertClient($row);
                    $key = $result['key'];
                    $clientIdByKey[$key] = $result['client_id'];
                    match ($result['action']) {
                        'created' => $clientsCreated++,
                        'updated' => $clientsUpdated++,
                        default => null,
                    };
                } catch (\Throwable $e) {
                    $errors[] = $this->errorRow('client', $index, $row, $e);
                }
            }

            foreach ($products as $index => $row) {
                try {
                    $clientId = $this->resolveClientId($row, $clientIdByKey);
                    if ($clientId === null) {
                        throw ValidationException::withMessages([
                            'client' => ['No se pudo resolver el cliente para el producto.'],
                        ]);
                    }

                    $result = $this->upsertProduct($row, $clientId);
                    match ($result['action']) {
                        'created' => $productsCreated++,
                        'updated' => $productsUpdated++,
                        default => $unchanged++,
                    };
                } catch (\Throwable $e) {
                    $errors[] = $this->errorRow('product', $index, $row, $e);
                }
            }
        };

        if ($dryRun) {
            DB::beginTransaction();
            try {
                $work();
            } finally {
                DB::rollBack();
            }
        } else {
            DB::transaction($work);
        }

        return [
            'dry_run' => $dryRun,
            'source_filename' => $sourceFilename,
            'total_clients' => count($this->dedupeClients($clients)),
            'total_products' => count($products),
            'clients_created' => $clientsCreated,
            'clients_updated' => $clientsUpdated,
            'products_created' => $productsCreated,
            'products_updated' => $productsUpdated,
            'unchanged' => $unchanged,
            'errors' => $errors,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $clients
     * @return list<array<string, mixed>>
     */
    private function dedupeClients(array $clients): array
    {
        $map = [];
        foreach ($clients as $row) {
            $rif = $this->normalizeRif((string) ($row['rif'] ?? ''));
            $name = trim((string) ($row['nombre_cliente'] ?? ''));
            if ($rif === '' && $name === '') {
                continue;
            }
            $key = $rif !== '' ? 'rif:'.$rif : 'name:'.mb_strtoupper($name);
            $map[$key] = [
                'nombre_cliente' => $name,
                'rif' => $rif,
                'sheet_name' => (string) ($row['sheet_name'] ?? ''),
                'row_number' => (int) ($row['row_number'] ?? 0),
            ];
        }

        return array_values($map);
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array{action: string, client_id: int, key: string}
     */
    private function upsertClient(array $row): array
    {
        $name = trim((string) ($row['nombre_cliente'] ?? ''));
        $rif = $this->normalizeRif((string) ($row['rif'] ?? ''));

        if ($name === '' && $rif === '') {
            throw ValidationException::withMessages([
                'nombre_cliente' => ['Cliente sin nombre ni RIF.'],
            ]);
        }

        if ($rif === '') {
            throw ValidationException::withMessages([
                'rif' => ['No se puede crear cliente nuevo sin RIF. Regístrelo primero en Clientes o corrija el Excel.'],
            ]);
        }

        $key = 'rif:'.$rif;
        /** @var Client|null $client */
        $client = Client::query()->where('rif', $rif)->first();

        if (! $client && $name !== '') {
            $client = Client::query()
                ->whereRaw('LOWER(TRIM(name)) = ?', [mb_strtolower($name)])
                ->first();
        }

        if (! $client) {
            if ($name === '') {
                throw ValidationException::withMessages([
                    'nombre_cliente' => ['Nombre de cliente obligatorio para alta.'],
                ]);
            }

            $client = Client::query()->create([
                'name' => $name,
                'rif' => $rif,
            ]);

            return ['action' => 'created', 'client_id' => (int) $client->id, 'key' => $key];
        }

        $dirty = false;
        if ($name !== '' && mb_strtolower(trim($client->name)) !== mb_strtolower($name)) {
            $client->name = $name;
            $dirty = true;
        }
        if ($client->rif !== $rif) {
            $client->rif = $rif;
            $dirty = true;
        }
        if ($dirty) {
            $client->save();

            return ['action' => 'updated', 'client_id' => (int) $client->id, 'key' => $key];
        }

        return ['action' => 'unchanged', 'client_id' => (int) $client->id, 'key' => $key];
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  array<string, int>  $clientIdByKey
     */
    private function resolveClientId(array $row, array $clientIdByKey): ?int
    {
        $rif = $this->normalizeRif((string) ($row['rif_cliente'] ?? ''));
        $name = trim((string) ($row['nombre_cliente'] ?? ''));

        if ($rif !== '') {
            $key = 'rif:'.$rif;
            if (isset($clientIdByKey[$key])) {
                return $clientIdByKey[$key];
            }
            $client = Client::query()->where('rif', $rif)->first();
            if ($client) {
                return (int) $client->id;
            }
        }

        if ($name !== '') {
            $key = 'name:'.mb_strtoupper($name);
            if (isset($clientIdByKey[$key])) {
                return $clientIdByKey[$key];
            }
            $client = Client::query()
                ->whereRaw('LOWER(TRIM(name)) = ?', [mb_strtolower($name)])
                ->first();
            if ($client) {
                return (int) $client->id;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array{action: string}
     */
    private function upsertProduct(array $row, int $clientId): array
    {
        $name = trim((string) ($row['producto'] ?? ''));
        if ($name === '') {
            throw ValidationException::withMessages([
                'producto' => ['Nombre de producto obligatorio.'],
            ]);
        }

        $payload = [
            'cpe' => $this->nullableString($row['cpe'] ?? null),
            'mps' => $this->nullableString($row['mps'] ?? null),
            'barcode' => $this->nullableString($row['cod_barra'] ?? null),
        ];

        /** @var Product|null $product */
        $product = Product::query()
            ->where('client_id', $clientId)
            ->whereRaw('LOWER(TRIM(name)) = ?', [mb_strtolower($name)])
            ->first();

        if (! $product) {
            Product::query()->create([
                'client_id' => $clientId,
                'name' => $name,
                'cpe' => $payload['cpe'],
                'mps' => $payload['mps'],
                'barcode' => $payload['barcode'],
                'print_type' => null,
                'structure' => null,
            ]);

            return ['action' => 'created'];
        }

        $dirty = false;
        foreach ($payload as $field => $value) {
            $current = $product->{$field};
            $currentNorm = $current === null ? null : trim((string) $current);
            if ($currentNorm !== $value) {
                $product->{$field} = $value;
                $dirty = true;
            }
        }

        if ($dirty) {
            $product->save();

            return ['action' => 'updated'];
        }

        return ['action' => 'unchanged'];
    }

    private function normalizeRif(string $raw): string
    {
        return trim((string) (RifNormalizer::normalize($raw) ?? ''));
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $t = trim((string) $value);
        if ($t === '' || mb_strtoupper($t) === 'N/A') {
            return null;
        }

        return $t;
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function errorRow(string $kind, int $index, array $row, \Throwable $e): array
    {
        $message = $e instanceof ValidationException
            ? collect($e->errors())->flatten()->first() ?? $e->getMessage()
            : $e->getMessage();

        $label = $kind === 'client'
            ? (string) ($row['nombre_cliente'] ?? '')
            : (string) ($row['producto'] ?? '');

        return [
            'index' => $index,
            'kind' => $kind,
            'sheet_name' => (string) ($row['sheet_name'] ?? ''),
            'row_number' => (int) ($row['row_number'] ?? 0),
            'name' => $label,
            'message' => (string) $message,
        ];
    }
}
