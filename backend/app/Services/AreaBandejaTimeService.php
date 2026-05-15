<?php

namespace App\Services;

use App\Models\CorteTimeSegment;
use App\Models\TintasTimeSegment;
use Illuminate\Support\Collection;

class AreaBandejaTimeService
{
    /**
     * @param  Collection<int, int|string>  $workOrderIds
     * @return array<int, array{effective_seconds: int, dead_seconds: int, open_segment_type: string|null, open_started_at: string|null}>
     */
    public function summariesForWorkOrderIds(Collection $workOrderIds, string $area): array
    {
        $ids = $workOrderIds->map(fn ($id) => (int) $id)->filter(fn ($id) => $id > 0)->unique()->values();
        if ($ids->isEmpty()) {
            return [];
        }

        return match ($area) {
            'corte' => $this->summarizeCorte($ids),
            'tintas' => $this->summarizeTintas($ids),
            default => [],
        };
    }

    /**
     * @param  Collection<int, int>  $ids
     * @return array<int, array{effective_seconds: int, dead_seconds: int, open_segment_type: string|null, open_started_at: string|null}>
     */
    private function summarizeCorte(Collection $ids): array
    {
        return $this->summarizeSegments(CorteTimeSegment::query(), $ids);
    }

    /**
     * @param  Collection<int, int>  $ids
     * @return array<int, array{effective_seconds: int, dead_seconds: int, open_segment_type: string|null, open_started_at: string|null}>
     */
    private function summarizeTintas(Collection $ids): array
    {
        return $this->summarizeSegments(TintasTimeSegment::query(), $ids);
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<\Illuminate\Database\Eloquent\Model>  $query
     * @param  Collection<int, int>  $ids
     * @return array<int, array{effective_seconds: int, dead_seconds: int, open_segment_type: string|null, open_started_at: string|null}>
     */
    private function summarizeSegments($query, Collection $ids): array
    {
        $segments = $query
            ->whereIn('work_order_id', $ids->all())
            ->orderBy('work_order_id')
            ->orderBy('started_at')
            ->get(['work_order_id', 'segment_type', 'started_at', 'ended_at']);

        $out = [];
        foreach ($ids as $woId) {
            $out[$woId] = [
                'effective_seconds' => 0,
                'dead_seconds' => 0,
                'open_segment_type' => null,
                'open_started_at' => null,
            ];
        }

        foreach ($segments as $seg) {
            $woId = (int) $seg->work_order_id;
            if (! isset($out[$woId])) {
                continue;
            }
            $type = (string) $seg->segment_type;
            if ($seg->ended_at === null) {
                $out[$woId]['open_segment_type'] = $type;
                $out[$woId]['open_started_at'] = $seg->started_at?->toIso8601String();

                continue;
            }
            $start = $seg->started_at?->getTimestamp() ?? 0;
            $end = $seg->ended_at->getTimestamp();
            $delta = max(0, $end - $start);
            if ($type === 'downtime') {
                $out[$woId]['dead_seconds'] += $delta;
            } else {
                $out[$woId]['effective_seconds'] += $delta;
            }
        }

        return $out;
    }
}
