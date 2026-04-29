<?php

declare(strict_types=1);

use App\Models\Client;
use App\Models\ClientOrder;
use App\Models\ClientOrderLine;
use App\Models\Product;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderTechnicalDocument;
use App\Services\AxonesDemoDataService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Hash;

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

/** @var AxonesDemoDataService $demo */
$demo = app(AxonesDemoDataService::class);
$demo->clean();

$boss = User::query()->where('email', 'boss@axones.local')->first();
if (! $boss) {
    $boss = User::query()->create([
        'name' => 'Boss Axones',
        'email' => 'boss@axones.local',
        'password' => Hash::make('password'),
        'role' => 'boss',
    ]);
}

$scenarios = [
    [
        'client' => 'Andrea',
        'rif' => 'V-30111222-1',
        'product' => 'Bolsa Arroz Andrea 1Kg',
        'machine' => 'COMEXI 1',
        'kg' => '120.000',
        'priority' => 'Urgente',
        'state_label' => 'Pendiente',
    ],
    [
        'client' => 'Juan',
        'rif' => 'V-28999888-2',
        'product' => 'Empaque Pasta Juan 500g',
        'machine' => 'COMEXI 3',
        'kg' => '98.500',
        'priority' => 'Normal',
        'state_label' => 'En proceso',
    ],
    [
        'client' => 'Fai',
        'rif' => 'V-27444555-3',
        'product' => 'Etiqueta Salsa Fai 250g',
        'machine' => 'Cortadora Permaco',
        'kg' => '75.250',
        'priority' => 'Alta',
        'state_label' => 'Programada',
    ],
];

$created = [];

foreach ($scenarios as $i => $row) {
    $client = Client::query()->create([
        'name' => $row['client'],
        'rif' => $row['rif'],
        'state' => 'Portuguesa',
        'city' => 'Acarigua',
        'address' => 'Zona Industrial',
        'email' => strtolower($row['client']).'@axones.local',
        'phone' => '+58 412-55555'.($i + 1),
    ]);

    $product = Product::query()->create([
        'client_id' => $client->getKey(),
        'name' => $row['product'],
        'cpe' => 'CPE-'.strtoupper($row['client']).'-'.str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT),
        'barcode' => '77099'.str_pad((string) ($i + 1), 8, '0', STR_PAD_LEFT),
        'mps' => 'MPS-'.strtoupper($row['client']).'-'.str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT),
        'print_type' => 'Flexografía',
        'structure' => 'BOPP + PEBD',
    ]);

    $clientOrder = ClientOrder::query()->create([
        'client_id' => $client->getKey(),
        'code' => ClientOrder::nextCode(),
        'status' => 'open',
        'ordered_at' => now()->toDateString(),
        'notes' => 'Pedido prueba '.$row['client'],
        'created_by' => $boss->getKey(),
    ]);

    ClientOrderLine::query()->create([
        'client_order_id' => $clientOrder->getKey(),
        'product_id' => $product->getKey(),
        'description' => $row['product'],
        'quantity' => $row['kg'],
        'unit' => 'Kg',
        'notes' => 'Línea de prueba',
        'position' => 0,
    ]);

    $workOrder = WorkOrder::query()->create([
        'code' => WorkOrder::nextCode(),
        'document_number' => WorkOrder::nextDocumentNumber(),
        'document_date' => now()->toDateString(),
        'client_order_reference' => $clientOrder->code,
        'client_order_id' => $clientOrder->getKey(),
        'client_id' => $client->getKey(),
        'product_id' => $product->getKey(),
        'status' => 'in_progress',
        'scheduling_status' => 'in_programming',
        'board_stage' => 'impresion',
        'notes' => 'OT prueba '.$row['client'],
        'created_by' => $boss->getKey(),
    ]);

    WorkOrderTechnicalDocument::query()->updateOrCreate(
        ['work_order_id' => $workOrder->getKey()],
        ['form' => [
            'cliente' => $client->name,
            'clienteRif' => $client->rif,
            'producto' => $product->name,
            'fechaOrden' => now()->toDateString(),
            'numeroOrden' => $workOrder->document_number,
            'pedidoKg' => $row['kg'],
            'maquina' => $row['machine'],
            'tipoImpresionEstructura' => 'superficie',
            'frecuencia' => '250±2',
            'anchoCorteMontaje' => '330±2',
            'numBandas' => '2',
            'numRepeticion' => '4',
            'numColores' => '8',
            'prioridad' => $row['priority'],
            'estado' => $row['state_label'],
        ]]
    );

    $created[] = [
        'code' => $workOrder->code,
        'cliente' => $client->name,
        'producto' => $product->name,
        'maquina' => $row['machine'],
        'kg' => $row['kg'],
        'prioridad' => $row['priority'],
        'estado' => $row['state_label'],
        'board_stage' => 'impresion',
    ];
}

echo json_encode($created, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE).PHP_EOL;
