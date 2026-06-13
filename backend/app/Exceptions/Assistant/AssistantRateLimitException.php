<?php

namespace App\Exceptions\Assistant;

use RuntimeException;

class AssistantRateLimitException extends RuntimeException
{
    public function __construct(string $message, public readonly int $used = 0, public readonly int $limit = 0)
    {
        parent::__construct($message);
    }
}
