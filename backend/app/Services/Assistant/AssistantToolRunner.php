<?php

namespace App\Services\Assistant;

use App\Support\AssistantToolResult;

/**
 * Ejecuta una tool por nombre con args validados externamente (Anthropic ya
 * valida el input_schema). Devuelve AssistantToolResult homogéneo.
 */
final class AssistantToolRunner
{
    public function __construct(
        private readonly AssistantToolRegistry $registry,
        private readonly AssistantInternalApiClient $api,
    ) {}

    /**
     * @param array<string,mixed> $args
     */
    public function run(string $name, array $args): AssistantToolResult
    {
        $tool = $this->registry->find($name);
        if ($tool === null) {
            return AssistantToolResult::fail("Tool desconocida: {$name}");
        }
        try {
            /** @var callable $handler */
            $handler = $tool->handler;

            return $handler($args, $this->api);
        } catch (\Throwable $e) {
            return AssistantToolResult::fromException($e);
        }
    }
}
