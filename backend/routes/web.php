<?php

use App\Http\Controllers\PanelController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect()->route('panel');
});

Route::get('/panel', PanelController::class)->name('panel');

// Evita errores 500 cuando algún cliente (o descarga) no envía Accept: application/json
// y el middleware auth intenta redirigir a la ruta "login".
Route::get('/login', function () {
    return response('Login no disponible en este entorno.', 200);
})->name('login');
