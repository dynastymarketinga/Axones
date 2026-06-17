# Formato Excel — Listado de productos (Axones)

Guía para el equipo: cómo debe estar armado el archivo **`.xlsx`** para importarlo en **Axones → Datos maestros → Especificaciones de producto → Importar Excel**.

También puede descargar la **plantilla vacía** desde la misma pantalla (**Plantilla vacía**). El archivo se llama `plantilla-listado-productos.xlsx`.

---

## Qué importa este Excel

Cada fila es una **especificación de producto** (plantilla técnico-comercial por cliente): nombre, CPE, M.P.P.S, código de barra.

**No incluye** tipo de impresión ni estructura del material; complételos después en Axones si hace falta.

---

## Formatos aceptados

### 1. Original (como viene de planta)

Una sola hoja (p. ej. `Hoja1`):

| Fila | Contenido |
|------|-----------|
| **6** | Encabezados (fila amarilla) |
| **7+** | Datos |

| Col | Encabezado | Campo en Axones |
|-----|------------|-----------------|
| A | producto | Nombre de la especificación |
| B | cliente | `Nombre empresa (RIF J-12345678-9)` |
| C | cpe | C.P.E. (texto; conservar ceros a la izquierda) |
| D | mps | M.P.P.S. |
| E | cod_barra | Código de barra maestro |

Valores **N/A** en CPE, MPS o código de barra se interpretan como vacío.

### 2. Organizado (recomendado para mantenimiento)

Pestañas:

- **INSTRUCCIONES** — guía (opcional)
- **CLIENTES** — `nombre_cliente | rif | cantidad_productos`
- **PRODUCTOS** — `producto | rif_cliente | nombre_cliente | cpe | mps | cod_barra | fila_origen`

El importador detecta automáticamente el formato por el nombre de las hojas.

---

## Orden de carga

1. **Clientes** — se crean o actualizan por RIF (obligatorio para clientes nuevos).
2. **Productos** — se enlazan al cliente por RIF; si ya existe el mismo nombre para ese cliente, se actualizan CPE, MPS y código de barra.

---

## Reglas importantes

- No puede haber dos especificaciones con el **mismo nombre** para el **mismo cliente**.
- El RIF debe poder parsearse (ej. `J-30827011-3`). Sin RIF no se puede dar de alta un cliente nuevo desde el Excel.
- Use formato **Texto** en Excel para CPE y código de barra (evita notación científica y pierde ceros).
- La exportación desde Axones genera un libro con hojas CLIENTES, PRODUCTOS y ORIGINAL (encabezados fila 6) para round-trip.

---

## Ejemplo de filas (listado planta)

| producto | cliente | cpe | mps |
|----------|---------|-----|-----|
| ALIMENTO LACTEO PARMALAT MAX 400g | INDUSTRIA LACTEA VENEZOLANA, C.A. (RIF J-00019368-1) | 0922523543 | A-155.514 |
| ARROZ PREMIUM SANTONI 900g | IMPROA SANTONI, C.A. (RIF J-30827011-3) | 0422515856 | A-101.240 |

---

## Flujo en Axones

1. **Importar Excel** → elegir archivo
2. Revisar resumen (clientes, productos, avisos)
3. **Vista previa** (dry-run, no guarda)
4. **Confirmar importación**

Si hay errores parciales, el toast indicará cuántas filas fallaron; corrija el Excel y vuelva a importar.
