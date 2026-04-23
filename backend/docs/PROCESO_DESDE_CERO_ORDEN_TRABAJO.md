# Proceso de cero hasta orden de trabajo (Axones)

## Cómo se “limpió” la base (desarrollo / reinicio)

En la carpeta `backend` se ejecuta:

```bash
php artisan migrate:fresh --seed
```

- **Borra todas las tablas** y las vuelve a crear (esquema actual).
- **Vuelve a ejecutar** los *seeders* de `DatabaseSeeder`.
- Queda una base **consistente** y lista para pruebas; no sustituye un respaldo de producción.

> Si solo quieres vaciar datos sin tocar estructura, usa otras estrategias (respaldo + import); el comando de arriba es el reinicio “de fábrica” del esquema Laravel.

---

## Qué queda “de fábrica” tras el seeder (lo importante)

| Qué | Detalle |
|-----|---------|
| **Usuarios** | `inventario@axones.local` y `jefe@axones.local` — contraseña: `password` |
| **Clientes** | Varios de demo (DemoClientsSeeder) |
| **Materiales** | Al menos 2 insumos en `materials` (área de inventario `material`), p. ej. BOPP/PE (DemoMaterialsSeeder) |
| **Órdenes de cliente** | ~55 pedidos de prueba, cada uno con al menos **una línea** ya ligada a un **material** (para poder crear OT e importar consumos) |

No tienes que rellenar a mano todo eso si acabas de correr el seeder: ya puedes probar el flujo en la app. Si en cambio partes de **base vacía sin seed** (solo migraciones), entonces aplica el orden de la siguiente sección.

---

## Orden lógico si empiezas “en blanco” (maestros → pedido → OT)

1. **Usuarios** (login en Pulse): al menos un usuario con rol adecuado (p. ej. jefe, inventario).
2. **Datos maestros de negocio**
   - **Cliente** (`clients`): a quién se factura / a quién pertenece el pedido.
   - **(Opcional) Producto** (`products`): referencia de producto terminado, si usas catálogo.
   - **Material / insumo** (`materials`): bobinas, film, etc. con `inventory_area` adecuado (para inventario y para líneas de pedido/OT). Sin filas en `materials` no podrás vincular consumos reales.
3. **Orden de cliente (pedido)**
   - Cabecera: `client_orders` (cliente, código, estado, notas).
   - Líneas: `client_order_lines` (cantidad, unidad, texto; idealmente **material** o producto según usen).
4. **Orden de trabajo (producción)**
   - En la app: **Producción → Órdenes de trabajo**: elegir la OC, **Crear orden**; se abre la planilla (`work_orders` + `work_order_technical_documents`, etc.).
   - Si al crear marcan “importar” desde el pedido, hace falta al menos **una línea de OC** con `material_id` apuntando a un material válido; si no, la OT se puede crear igual y se completa la planilla a mano.

Relación de tablas (resumen): `clients` → `client_orders` → `client_order_lines` (→ `materials`, `products`); `work_orders` enlaza con `client_order_id`; `work_order_lines` consume `materials`; `material_requests` cuelga de `work_orders`.

---

## Dónde hacer cada cosa en la app (flujo de pantallas)

1. **Maestros:** menú *Datos* (o equivalente): **Clientes**, **Productos**, **Materiales** según haga falta.
2. **Pedido comercial:** **Producción → Órdenes de cliente** → nueva orden, líneas con cantidad; si quieren importar a la OT, línea con **material** de inventario.
3. **Producción:** **Producción → Órdenes de trabajo** → pestaña con lista y formulario *Crear orden* → elige la OC y crear; luego **Abrir** la OT para llenar la planilla.

---

## Comandos SQL alternativos (phpMyAdmin)

En `database/sql/carga_materiales_y_lineas_oc.sql` hay un ejemplo mínimo para **insertar un material** y **asignar `material_id`** en líneas de OC que lo tengan en NULL (solo si operas sin `migrate:fresh --seed`).

---

## Resumen de una frase

**Maestro (cliente + material) → pedido (OC) con líneas → orden de trabajo (OT) y planilla.**
