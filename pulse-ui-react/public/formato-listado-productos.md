# Formato Excel — Listado de productos (Axones)

Guía para el equipo: cómo debe estar armado el archivo **`.xlsx`** para importarlo en **Axones → Datos maestros → Especificaciones de producto → Importar Excel**.

También puede descargar la **plantilla vacía** desde la misma pantalla (**Plantilla vacía**). El archivo se llama `plantilla-listado-productos.xlsx`.

---

## Flujo recomendado (3 pasos)

1. **Complete la hoja CLIENTES** — nombre del cliente y RIF (obligatorio).
2. **Complete la hoja PRODUCTOS** — una fila por especificación; el RIF del cliente debe coincidir.
3. En Axones: **Importar Excel** → revise la vista previa → **Confirmar importación**.

---

## Qué importa este Excel

Cada fila es una **especificación de producto** (plantilla técnico-comercial por cliente):

| Campo en Axones | Columna en Excel (hoja PRODUCTOS) |
|-----------------|-----------------------------------|
| Nombre | Nombre del producto |
| Cliente (RIF) | RIF del cliente |
| Cliente (nombre) | Nombre del cliente |
| C.P.E. | C.P.E. |
| M.P.P.S. | M.P.P.S. |
| Código de barra | Código de barra |
| Tipo de impresión *(opcional)* | Tipo de impresión |
| Estructura *(opcional)* | Estructura |

**Tipo de impresión** aceptado: `Superficie`, `Bilaminado` o `Trilaminado`.

---

## Estructura del libro

### Plantilla vacía (descarga desde Axones)

| Hoja | Contenido |
|------|-----------|
| **INSTRUCCIONES** | Guía paso a paso |
| **CLIENTES** | Encabezados en fila 1 (verde) |
| **PRODUCTOS** | Encabezados en fila 1 (verde) |

### Exportación desde Axones

Las mismas hojas **más**:

| Hoja | Contenido |
|------|-----------|
| **ORIGINAL** | Formato listado de planta (encabezados fila 6, amarillo). No es necesario editarla en el flujo habitual. |

---

## Encabezados en español (hoja CLIENTES)

| Columna | Encabezado |
|---------|------------|
| A | Nombre del cliente |
| B | RIF |
| C | Cantidad de productos *(solo informativo al exportar)* |

## Encabezados en español (hoja PRODUCTOS)

| Columna | Encabezado |
|---------|------------|
| A | Nombre del producto |
| B | RIF del cliente |
| C | Nombre del cliente |
| D | C.P.E. |
| E | M.P.P.S. |
| F | Código de barra |
| G | Tipo de impresión |
| H | Estructura |

El importador también acepta encabezados técnicos legacy (`producto`, `rif_cliente`, `cpe`, etc.).

---

## Formato original de planta (alternativa)

Una sola hoja con encabezados en **fila 6** y datos desde **fila 7**:

| Col | Encabezado | Campo |
|-----|------------|-------|
| A | producto | Nombre |
| B | cliente | `Nombre empresa (RIF J-12345678-9)` |
| C | cpe | C.P.E. |
| D | mps | M.P.P.S. |
| E | cod_barra | Código de barra |

En este formato **no** vienen tipo de impresión ni estructura.

---

## Reglas importantes

- No puede haber dos especificaciones con el **mismo nombre** para el **mismo cliente**.
- El RIF debe poder parsearse (ej. `J-30827011-3`). Sin RIF no se puede dar de alta un cliente nuevo desde el Excel.
- Use formato **Texto** en Excel para C.P.E. y código de barra (evita notación científica y pierde ceros).
- Valores **N/A** en campos opcionales se interpretan como vacío.
- Al **actualizar** un producto existente, si deja vacío tipo de impresión o estructura en el Excel, **no se borran** los valores ya guardados en Axones.

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
