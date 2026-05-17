<?php

namespace Tests\Unit;

use App\Support\CortePlanillaSalida;
use PHPUnit\Framework\TestCase;

class CortePlanillaSalidaSanitizeTest extends TestCase
{
    public function test_sanitize_converts_null_rollos_to_empty_strings(): void
    {
        $form = [
            'cor_paletas' => [
                [
                    'id' => 'p-01',
                    'rollosKg' => [null, '12.5', null],
                    'status' => 'en_progreso',
                ],
            ],
        ];

        $out = CortePlanillaSalida::sanitizePersistedFormArrays($form);
        $rollos = $out['cor_paletas'][0]['rollosKg'];

        $this->assertSame('', $rollos[0]);
        $this->assertSame('12.5', $rollos[1]);
        $this->assertSame('', $rollos[2]);
        $this->assertCount(48, $rollos);
    }
}
