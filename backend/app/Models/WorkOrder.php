<?php

namespace App\Models;

use App\Enums\WorkOrderBoardStage;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class WorkOrder extends Model
{
    protected $fillable = [
        'code',
        'document_number',
        'document_date',
        'issued_to',
        'issued_from',
        'authorized_by_name',
        'authorized_by_title',
        'client_order_reference',
        'client_order_id',
        'client_id',
        'product_id',
        'status',
        'scheduling_status',
        'board_stage',
        'notes',
        'winding_figure',
        'created_by',
    ];

    public static function nextCode(): string
    {
        $prefix = 'OT-'.now()->format('Y').'-';
        $last = self::query()->where('code', 'like', $prefix.'%')->orderByDesc('id')->value('code');
        $n = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $n, 5, '0', STR_PAD_LEFT);
    }

    /**
     * Número de documento impreso tipo 010-26 (secuencial + año corto).
     */
    public static function nextDocumentNumber(): string
    {
        $yy = now()->format('y');
        $max = 0;
        $suffix = '-'.$yy;
        foreach (self::query()->whereNotNull('document_number')->pluck('document_number') as $dn) {
            if (str_ends_with((string) $dn, $suffix) && preg_match('/^(\d+)-'.preg_quote($yy, '/').'$/', (string) $dn, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return str_pad((string) ($max + 1), 3, '0', STR_PAD_LEFT).$suffix;
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function clientOrder(): BelongsTo
    {
        return $this->belongsTo(ClientOrder::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function materialRequests(): HasMany
    {
        return $this->hasMany(MaterialRequest::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(WorkOrderLine::class);
    }

    public function productionItems(): HasMany
    {
        return $this->hasMany(WorkOrderProductionItem::class)->orderBy('position')->orderBy('id');
    }

    public function printingTimeSegments(): HasMany
    {
        return $this->hasMany(PrintingTimeSegment::class);
    }

    public function printingBobinaUsages(): HasMany
    {
        return $this->hasMany(PrintingBobinaUsage::class);
    }

    public function printingSummary(): HasOne
    {
        return $this->hasOne(WorkOrderPrintingSummary::class);
    }

    public function printingInkControlLines(): HasMany
    {
        return $this->hasMany(PrintingInkControlLine::class)->orderBy('position')->orderBy('id');
    }

    public function printingChemicalUsages(): HasMany
    {
        return $this->hasMany(PrintingChemicalUsage::class)->orderBy('chemical_type');
    }

    public function technicalDocument(): HasOne
    {
        return $this->hasOne(WorkOrderTechnicalDocument::class);
    }

    protected function casts(): array
    {
        return [
            'board_stage' => WorkOrderBoardStage::class,
            'document_date' => 'date',
            'winding_figure' => 'integer',
        ];
    }
}
