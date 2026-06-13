<?php

namespace App\Services\Assistant;

use App\Exceptions\Assistant\AssistantApiException;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Cliente HTTP "in-process" para que las tools del asistente reutilicen la
 * misma API REST que la SPA. Construye un Request sintético con el Bearer
 * token del usuario actual y lo despacha por el kernel HTTP de Laravel — no
 * sale a la red, hereda Sanctum, middlewares y políticas tal cual están en
 * producción.
 */
final class AssistantInternalApiClient
{
    private ?string $bearerToken = null;

    public function __construct(
        private readonly HttpKernel $kernel,
        private readonly Application $app,
    ) {}

    public function withBearerToken(?string $token): self
    {
        $this->bearerToken = $token !== null && trim($token) !== '' ? trim($token) : null;

        return $this;
    }

    /**
     * @param  array<string, scalar|null>  $query
     * @return array<mixed>
     */
    public function get(string $path, array $query = []): array
    {
        $path = '/'.ltrim($path, '/');
        $path = str_starts_with($path, '/api/') ? $path : '/api'.$path;

        $clean = [];
        foreach ($query as $k => $v) {
            if ($v === null || $v === '') {
                continue;
            }
            $clean[$k] = is_bool($v) ? ($v ? 'true' : 'false') : (string) $v;
        }

        $server = [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ];
        if ($this->bearerToken !== null) {
            $server['HTTP_AUTHORIZATION'] = 'Bearer '.$this->bearerToken;
        }

        $request = Request::create($path, 'GET', $clean, [], [], $server);

        /** @var Response $response */
        $response = $this->kernel->handle($request);

        $body = $response->getContent();
        $decoded = null;
        if (is_string($body) && $body !== '') {
            $decoded = json_decode($body, true);
        }

        if ($response->getStatusCode() >= 400) {
            $msg = is_array($decoded) && isset($decoded['message']) && is_string($decoded['message'])
                ? $decoded['message']
                : 'HTTP '.$response->getStatusCode();
            throw new AssistantApiException($msg, $response->getStatusCode(), $decoded);
        }

        if (! is_array($decoded)) {
            throw new AssistantApiException(
                "Respuesta no-JSON al llamar {$path}",
                $response->getStatusCode(),
                $body,
            );
        }

        /** @var array<mixed> $decoded */
        return $decoded;
    }
}
