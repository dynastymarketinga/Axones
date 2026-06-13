<?php

namespace App\Support;

/**
 * Resultado normalizado de cada tool del asistente. Espejo exacto de
 * `AxonesToolResult` en bot/src/types.ts — el LLM y el frontend reciben
 * siempre esta forma para poder pintar dots y follow_up_chips.
 *
 * @phpstan-type AssistantDotArray array{type:string,id:int|string,label:string,href:string}
 * @phpstan-type AssistantChipArray array{label:string,tool:string,params?:array<string,mixed>}
 */
final class AssistantToolResult
{
    /**
     * @param array<int, AssistantDotArray> $dots
     * @param array<int, AssistantChipArray> $followUpChips
     */
    private function __construct(
        public readonly bool $ok,
        public readonly ?string $summary,
        public readonly mixed $data,
        public readonly array $dots,
        public readonly array $followUpChips,
        public readonly ?string $error,
    ) {}

    /**
     * @param array{summary?:?string,data?:mixed,dots?:array<int,AssistantDotArray>,follow_up_chips?:array<int,AssistantChipArray>} $payload
     */
    public static function ok(array $payload = []): self
    {
        return new self(
            ok: true,
            summary: $payload['summary'] ?? null,
            data: $payload['data'] ?? null,
            dots: $payload['dots'] ?? [],
            followUpChips: $payload['follow_up_chips'] ?? [],
            error: null,
        );
    }

    public static function fail(string $error): self
    {
        return new self(true === false, null, null, [], [], $error);
    }

    public static function fromException(\Throwable $err): self
    {
        return self::fail($err->getMessage() !== '' ? $err->getMessage() : (new \ReflectionClass($err))->getShortName());
    }

    /**
     * @return array{ok:bool,summary?:string,data?:mixed,dots?:array<int,AssistantDotArray>,follow_up_chips?:array<int,AssistantChipArray>,error?:string}
     */
    public function toArray(): array
    {
        $out = ['ok' => $this->ok];
        if ($this->summary !== null) {
            $out['summary'] = $this->summary;
        }
        if ($this->data !== null) {
            $out['data'] = $this->data;
        }
        if ($this->dots !== []) {
            $out['dots'] = $this->dots;
        }
        if ($this->followUpChips !== []) {
            $out['follow_up_chips'] = $this->followUpChips;
        }
        if ($this->error !== null) {
            $out['error'] = $this->error;
        }

        return $out;
    }
}
