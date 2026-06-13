<?php

namespace App\Services\Assistant;

use App\Support\AssistantToolResult;

/**
 * Definición de una tool: metadatos + handler. La forma del input_schema
 * sigue el formato de Anthropic tool use (JSON Schema).
 */
final class AssistantTool
{
    /**
     * @param array<string, mixed> $inputSchema
     * @param callable(array<string, mixed>, AssistantInternalApiClient): AssistantToolResult $handler
     */
    public function __construct(
        public readonly string $name,
        public readonly string $title,
        public readonly string $description,
        public readonly array $inputSchema,
        public readonly bool $isAnalysis,
        public readonly mixed $handler,
    ) {}
}
