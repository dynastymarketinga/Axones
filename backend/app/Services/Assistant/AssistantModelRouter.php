<?php

namespace App\Services\Assistant;

/**
 * Elige modelo "rápido" o "análisis" en función de la pregunta y de las tools
 * que el orquestador ya invocó. Heurística simple por palabras clave; el
 * frontend puede forzar `force_analysis: true` cuando el usuario pide
 * explícitamente análisis.
 */
final class AssistantModelRouter
{
    private const ANALYSIS_KEYWORDS = [
        'compara', 'comparar', 'comparativ', 'tendencia', 'tendencias',
        'analiza', 'analizar', 'análisis', 'analisis', 'evolucion', 'evolución',
        'merma', 'mermas', 'scrap', 'desperdicio', 'desperdici',
        'tiempo', 'tiempos', 'rendimiento', 'eficienc', 'productivid',
        'diferencia', 'diferencias', 'crece', 'creció', 'crecimiento',
        'porcent', 'porcentaje', 'kpi', 'kpis',
    ];

    public function pick(string $userMessage, bool $forceAnalysis = false): string
    {
        $simple = (string) config('axones.assistant.model', 'claude-3-5-haiku-latest');
        $analysis = (string) config('axones.assistant.analysis_model', 'claude-sonnet-4-20250514');
        if ($forceAnalysis) {
            return $analysis;
        }
        $lower = mb_strtolower($userMessage, 'UTF-8');
        foreach (self::ANALYSIS_KEYWORDS as $kw) {
            if (mb_strpos($lower, $kw) !== false) {
                return $analysis;
            }
        }

        return $simple;
    }
}
