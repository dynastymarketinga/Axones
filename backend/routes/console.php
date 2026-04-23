<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('axones:demo {--clean : Borra los datos demo}', function () {
    /** @var \App\Services\AxonesDemoDataService $demo */
    $demo = app(\App\Services\AxonesDemoDataService::class);

    if ($this->option('clean')) {
        $demo->clean();
        $this->info('Datos demo eliminados. BD limpia.');
        return;
    }

    $result = $demo->seed();
    $this->info('Datos demo cargados.');
    $this->line(json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
})->purpose('Cargar o limpiar datos demo Axones');
