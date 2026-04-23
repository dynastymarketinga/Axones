-- Carga mínima para poder crear OT importando consumos desde la OC.
-- Uso: phpMyAdmin o cliente MySQL/MariaDB sobre la misma base que usa Laravel.
-- Preferible en Laravel:  php artisan db:seed --class=DemoMaterialsSeeder
--                         php artisan db:seed --class=BackfillClientOrderLinesWithDefaultMaterialSeeder

-- 1) Material de inventario (área "material") — idempotente por SKU
INSERT INTO materials (sku, name, barcode, inventory_area, tinta_presentacion, unit, min_stock, quantity_on_hand, notes, created_at, updated_at)
SELECT
  'AX-BOPP-25-560',
  'BOPP 25μ ancho 560 mm (genérico)',
  NULL,
  'material',
  NULL,
  'kg',
  0,
  1000,
  'Carga SQL manual / demo',
  NOW(),
  NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM materials m WHERE m.sku = 'AX-BOPP-25-560');

-- 2) Líneas de pedido sin material: asignan el insumo anteriores
UPDATE client_order_lines col
INNER JOIN materials m ON m.sku = 'AX-BOPP-25-560'
SET col.material_id = m.id
WHERE col.material_id IS NULL;
