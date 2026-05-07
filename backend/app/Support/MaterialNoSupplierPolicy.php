<?php

namespace App\Support;

use Illuminate\Contracts\Auth\Authenticatable;

final class MaterialNoSupplierPolicy
{
    /**
     * Roles que pueden dejar el material sin proveedor sin completar `no_supplier_reason`.
     */
    public static function canOmitNoSupplierReason(?Authenticatable $user): bool
    {
        $role = mb_strtolower(trim((string) ($user?->role ?? '')));

        return in_array($role, [
            'boss',
            'admin',
            'jefe_supremo',
            'superadmin',
            'jefe_operaciones',
            'inventory_chief',
            'jefe_inventario',
            'jefe_almacen',
        ], true);
    }
}
