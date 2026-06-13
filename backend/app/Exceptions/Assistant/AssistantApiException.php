<?php

namespace App\Exceptions\Assistant;

use RuntimeException;

class AssistantApiException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 0, public readonly mixed $body = null)
    {
        parent::__construct($message);
    }
}
