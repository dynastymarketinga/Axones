<?php

namespace Database\Seeders;

use App\Models\Client;
use Illuminate\Database\Seeder;

/**
 * 25 clientes de demostración (nombres y RIF distintos) para probar filtros y combos en UI.
 * Idempotente: actualiza por RIF si ya existía.
 */
class DemoClientsSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            ['name' => 'Millennium C.A.', 'rif' => 'J-30000001-0', 'state' => 'Portuguesa', 'city' => 'Acarigua', 'phone' => '0255-0000001'],
            ['name' => 'Supermercado La Plaza', 'rif' => 'J-30000002-8', 'state' => 'Portuguesa', 'city' => 'Araure', 'phone' => '0255-0000002'],
            ['name' => 'Dist. El Tocuyo 2020', 'rif' => 'J-30000003-6', 'state' => 'Lara', 'city' => 'Barquisimeto', 'phone' => '0251-0000001'],
            ['name' => 'Carnes y Más, R.L.', 'rif' => 'J-30000004-4', 'state' => 'Yaracuy', 'city' => 'San Felipe', 'phone' => '0254-0000001'],
            ['name' => 'Embutidos Gómez', 'rif' => 'J-30000005-2', 'state' => 'Portuguesa', 'city' => 'Guanare', 'phone' => '0257-0000001'],
            ['name' => 'Abasto Central Portuguesa', 'rif' => 'J-30000006-0', 'state' => 'Portuguesa', 'city' => 'Acarigua', 'phone' => '0255-0000003'],
            ['name' => 'Ferretería y Alimentos Unión', 'rif' => 'J-30000007-9', 'state' => 'Trujillo', 'city' => 'Valera', 'phone' => '0271-0000001'],
            ['name' => 'MiniMarket Los Pinos', 'rif' => 'J-30000008-7', 'state' => 'Cojedes', 'city' => 'San Carlos', 'phone' => '0258-0000001'],
            ['name' => 'Hielo y Pescado del Este', 'rif' => 'J-30000009-5', 'state' => 'Anzoátegui', 'city' => 'Barcelona', 'phone' => '0281-0000001'],
            ['name' => 'Distribuidora 5 Estrellas', 'rif' => 'J-30000010-3', 'state' => 'Aragua', 'city' => 'Maracay', 'phone' => '0243-0000001'],
            ['name' => 'Bodegón Roca Fuerte', 'rif' => 'J-30000011-1', 'state' => 'Carabobo', 'city' => 'Valencia', 'phone' => '0241-0000001'],
            ['name' => 'Frigorífico Llanero', 'rif' => 'J-30000012-0', 'state' => 'Barinas', 'city' => 'Barinas', 'phone' => '0273-0000001'],
            ['name' => 'Cárnica Industrial Delta', 'rif' => 'J-30000013-8', 'state' => 'Delta Amacuro', 'city' => 'Tucupita', 'phone' => '0287-0000001'],
            ['name' => 'Pulpería El Éxito 95', 'rif' => 'J-30000014-6', 'state' => 'Portuguesa', 'city' => 'Ospino', 'phone' => '0255-0000004'],
            ['name' => 'Suministros Médanos', 'rif' => 'J-30000015-4', 'state' => 'Falcón', 'city' => 'Coro', 'phone' => '0266-0000001'],
            ['name' => 'Pollo en Brasa Don Luis', 'rif' => 'J-30000016-2', 'state' => 'Portuguesa', 'city' => 'Araure', 'phone' => '0255-0000005'],
            ['name' => 'Cesta Familiar 24/7', 'rif' => 'J-30000017-0', 'state' => 'Miranda', 'city' => 'Guarenas', 'phone' => '0212-0000001'],
            ['name' => 'Merca Mayorista 2000', 'rif' => 'J-30000018-9', 'state' => 'Distrito Capital', 'city' => 'Caracas', 'phone' => '0212-0000002'],
            ['name' => 'Fonda y Bodegón Surtidor', 'rif' => 'J-30000019-7', 'state' => 'Carabobo', 'city' => 'Guacara', 'phone' => '0241-0000002'],
            ['name' => 'Cárnicos y Envasados Táchira', 'rif' => 'J-30000020-5', 'state' => 'Táchira', 'city' => 'San Cristóbal', 'phone' => '0276-0000001'],
            ['name' => 'Punto Fresco C.A.', 'rif' => 'J-30000021-3', 'state' => 'Mérida', 'city' => 'Mérida', 'phone' => '0274-0000001'],
            ['name' => 'Abastos y Charcutería Don Pancho', 'rif' => 'J-30000022-1', 'state' => 'Zulia', 'city' => 'Maracaibo', 'phone' => '0261-0000001'],
            ['name' => 'Europanelas de Occidente', 'rif' => 'J-30000023-0', 'state' => 'Portuguesa', 'city' => 'Acarigua', 'phone' => '0255-0000006'],
            ['name' => 'Bodegón y Licorería 5 de Julio', 'rif' => 'J-30000024-8', 'state' => 'Sucre', 'city' => 'Cumaná', 'phone' => '0293-0000001'],
            ['name' => 'Distrimerca Los Llanos', 'rif' => 'J-30000025-6', 'state' => 'Guárico', 'city' => 'San Juan de los Morros', 'phone' => '0238-0000001'],
        ];

        foreach ($rows as $r) {
            Client::query()->updateOrCreate(
                ['rif' => $r['rif']],
                [
                    'name' => $r['name'],
                    'state' => $r['state'],
                    'city' => $r['city'],
                    'phone' => $r['phone'] ?? null,
                ]
            );
        }
    }
}
