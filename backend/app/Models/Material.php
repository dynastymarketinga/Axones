<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class Material extends Model
{
    protected $fillable = [
        'sku',
        'internal_code',
        'created_by_user_id',
        'name',
        'barcode',
        'inventory_area',
        'micras',
        'ancho',
        'unit',
        'min_stock',
        'notes',
        'supplier_id',
        'no_supplier_reason',
    ];

    protected function casts(): array
    {
        return [
            'min_stock' => 'decimal:3',
            'quantity_on_hand' => 'decimal:3',
            'micras' => 'decimal:3',
            'ancho' => 'decimal:3',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Material $material): void {
            if (empty($material->internal_code)) {
                $material->internal_code = self::generateInternalCode((string) $material->sku);
            }

            if (empty($material->created_by_user_id) && Auth::check()) {
                $material->created_by_user_id = (int) Auth::id();
            }
        });
    }

    /**
     * Genera un código interno relacionado con el SKU pero único, para uso
     * exclusivo del desarrollador desde la base de datos.
     */
    public static function generateInternalCode(string $sku): string
    {
        $base = mb_strtoupper(Str::slug(trim($sku) !== '' ? $sku : 'MAT', '-'));
        if ($base === '') {
            $base = 'MAT';
        }

        for ($i = 0; $i < 20; $i++) {
            $candidate = mb_substr($base, 0, 50).'-'.mb_strtoupper(Str::random(5));
            if (! self::query()->where('internal_code', $candidate)->exists()) {
                return $candidate;
            }
        }

        return mb_substr($base, 0, 40).'-'.mb_strtoupper(Str::random(10));
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'product_ink_material')
            ->withTimestamps();
    }

    /** Productos vinculados a sustratos (inventario área material). */
    public function substrateProducts(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'material_product')
            ->withTimestamps();
    }

    public function tintaSubareas(): HasMany
    {
        return $this->hasMany(TintaSubarea::class);
    }
}
