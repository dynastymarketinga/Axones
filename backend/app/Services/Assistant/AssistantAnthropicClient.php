<?php

namespace App\Services\Assistant;

use App\Exceptions\Assistant\AssistantProviderException;
use Illuminate\Support\Facades\Http;

/**
 * Cliente delgado para la API de Mensajes de Anthropic. No streamea (MVP).
 * Se inyecta como singleton; en tests se intercepta con Http::fake().
 */
final class AssistantAnthropicClient
{
    public const ANTHROPIC_VERSION = '2023-06-01';
    public const ENDPOINT = 'https://api.anthropic.com/v1/messages';

    /**
     * @param array<int, array<string,mixed>> $messages
     * @param array<int, array<string,mixed>> $tools
     * @return array<string,mixed>
     */
    public function createMessage(string $model, array $messages, array $tools, string $system, int $maxTokens, int $timeoutSeconds): array
    {
        $apiKey = (string) config('axones.assistant.anthropic_api_key', '');
        if ($apiKey === '') {
            throw new AssistantProviderException('ANTHROPIC_API_KEY no configurado.');
        }
        $payload = [
            'model' => $model,
            'max_tokens' => $maxTokens,
            'system' => $system,
            'messages' => $messages,
        ];
        if ($tools !== []) {
            $payload['tools'] = $tools;
        }
        $response = Http::withHeaders([
            'x-api-key' => $apiKey,
            'anthropic-version' => self::ANTHROPIC_VERSION,
            'content-type' => 'application/json',
            'accept' => 'application/json',
        ])->timeout($timeoutSeconds)->post(self::ENDPOINT, $payload);

        $body = $response->json();
        if ($response->failed()) {
            $msg = is_array($body) && isset($body['error']['message']) && is_string($body['error']['message'])
                ? $body['error']['message']
                : "Anthropic HTTP {$response->status()}";
            throw new AssistantProviderException($msg, $response->status(), $body);
        }
        if (! is_array($body)) {
            throw new AssistantProviderException('Respuesta no-JSON de Anthropic.', $response->status(), $body);
        }

        return $body;
    }
}
