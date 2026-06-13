<?php

namespace App\Providers;

use Illuminate\Support\Facades\App;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Asistente Axones: el cliente HTTP interno debe ser el mismo entre el
        // orquestador y el runner para que el Bearer token aplicado al inicio
        // de cada request se propague a todas las tools de ese turno.
        $this->app->singleton(\App\Services\Assistant\AssistantInternalApiClient::class);
        $this->app->singleton(\App\Services\Assistant\AssistantToolRegistry::class);
        $this->app->singleton(\App\Services\Assistant\AssistantAnthropicClient::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        App::setLocale(config('app.locale', 'es'));
    }
}
