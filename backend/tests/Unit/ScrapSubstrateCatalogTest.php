<?php

namespace Tests\Unit;

use App\Support\ScrapSubstrateCatalog;
use Tests\TestCase;

class ScrapSubstrateCatalogTest extends TestCase
{
    public function test_mixed_structure_is_ambiguous_without_explicit(): void
    {
        $structure = 'BOPP 20 + PEBD';
        $this->assertTrue(ScrapSubstrateCatalog::structureInferenceIsAmbiguous($structure));
        $this->assertFalse(ScrapSubstrateCatalog::structureInferenceMatchesGroup($structure, 'bopp'));
        $this->assertFalse(ScrapSubstrateCatalog::structureInferenceMatchesGroup($structure, 'polietileno'));
    }

    public function test_single_group_structure_infers_correctly(): void
    {
        $this->assertTrue(ScrapSubstrateCatalog::structureInferenceMatchesGroup('Solo BOPP 18', 'bopp'));
        $this->assertTrue(ScrapSubstrateCatalog::structureInferenceMatchesGroup('Polietileno 50', 'polietileno'));
    }

    public function test_legacy_politerlero_alias_normalizes(): void
    {
        $this->assertSame('polietileno', ScrapSubstrateCatalog::normalizeGroupId('politerlero'));
    }
}
