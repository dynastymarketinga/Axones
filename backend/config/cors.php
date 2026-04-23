<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    // Incluir todas las rutas: si el patrón solo fuera `api/*`, en algunos despliegues/túneles el
    // preflight OPTIONS no coincidía y el navegador veía la respuesta sin CORS (mismo síntoma que un 502).
    'paths' => ['*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => ['*'],

    // Refuerzo para túneles *.trycloudflare.com (origen distinto al del API en otro subdominio).
    'allowed_origins_patterns' => [
        '#^https://[a-z0-9-]+\.trycloudflare\.com$#i',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
