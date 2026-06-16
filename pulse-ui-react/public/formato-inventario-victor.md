# Formato Excel de inventario (Victor → Axones)

Guía para el equipo de planta: cómo debe estar armado el archivo **`.xlsx`** para importarlo en **Axones → Inventario → Materiales → Importar Excel**.

También puede descargar la **plantilla vacía** desde la misma pantalla (**Plantilla vacía** / **Descargar plantilla vacía**). El archivo se llama `plantilla-inventario-victor.xlsx`.

---

## Regla de oro

1. **Una pestaña = un tipo de insumo** (sustrato, tintas, químicos o consumibles).
2. **Los encabezados de columna deben coincidir** con los de esta guía (texto exacto).
3. **El stock en KG o CANTIDAD** del Excel será el stock final en Axones tras importar.

El sistema **no adivina** el tipo por el nombre del producto (“BOPP”, “BLANCO”, “Brochas”). Lee **el nombre de la pestaña** y **las columnas**.

---

## Pestañas del libro

| Pestaña en Excel | Qué es | Dónde aparece en Axones |
|------------------|--------|-------------------------|
| **Hoja2, Hoja3… Hoja9** (formato sustrato) | Films / bobinas | **Sustrato** |
| **TINTAS** | Tintas | **Tintas** |
| **QUÍMICOS** | Químicos de proceso | **Químicos** |
| **COSUMIBLES (2)** | Ferretería, consumibles, etc. | **Misceláneos** |

> **Consumibles** en Excel = **Misceláneos** en Axones (mismo dato, distinto nombre en pantalla).

Puede tener **varias hojas de sustrato** (Hoja2, Hoja3, …): cada una con un film distinto (BOPP NORMAL, BOPP MATE, METAL, etc.). Lo importante es que **la fila 1** tenga los encabezados correctos.

---

## 1. Sustratos (Hoja2, Hoja3, Hoja4…)

### Fila 1 — encabezados (obligatorio)

| A | B | C | D |
|---|---|---|---|
| **MATERIAL** | **MICRAS** | **ANCHO** | **KG** |

No cambiar esos textos (no usar “Nombre”, “Producto”, etc.).

### Filas 2 en adelante — datos

| MATERIAL | MICRAS | ANCHO | KG |
|----------|--------|-------|-----|
| BOPP NORMAL | 20 | 600 | 1883.08 |
| BOPP NORMAL | 25 | 560 | 0 |

| Columna | Significado |
|---------|-------------|
| **MATERIAL** | Nombre del film (BOPP NORMAL, METAL, PEBD, …) |
| **MICRAS** | Espesor (número) |
| **ANCHO** | Ancho en mm (número) |
| **KG** | Stock en kilos (puede ser 0) |

**Ejemplo en plantilla:** pestaña `Hoja3` con una fila de ejemplo. Duplique la hoja y cambie el nombre del material en la columna A para otra familia de film.

---

## 2. Tintas (pestaña **TINTAS**)

La pestaña debe llamarse **TINTAS**.

### Estructura

- **Columnas A–C:** bloque izquierdo (típicamente **laminación**).
- **Columnas E–G:** bloque derecho (típicamente **superficie**).

### Filas de título (como en el archivo de planta)

- Fila con **LAMINACION** / **SUPERFICIE** (u otras secciones: **PRUEBA LAMINACION**, **LAMINACION NUEVA**).
- Fila de encabezados: **COLOR | CÓDIGO | KG** en cada bloque.

### Filas de datos

| COLOR | CÓDIGO | KG |
|-------|--------|-----|
| BLANCO | BL-2036 | 1080 |
| NEGRO | BL-2054 | 152 |

| Columna | Significado |
|---------|-------------|
| **COLOR** | Nombre de la tinta |
| **CÓDIGO** | Código interno (referencia en planta) |
| **KG** | Stock en kilos |

Las filas que solo repiten **LAMINACION**, **SUPERFICIE**, etc. son **títulos de sección**, no productos.

---

## 3. Químicos (pestaña **QUÍMICOS**)

El nombre de la pestaña debe contener **QUIMIC** (ej. **QUÍMICOS**).

### Encabezados (fila 9 en el formato de planta)

| B | C | D |
|---|---|---|
| **COD** | **MATERIAL** | **KG** |

### Datos (desde fila 10)

| COD | MATERIAL | KG |
|-----|----------|-----|
| SOL IPA 001 | ALCOHOL ISOPROPILICO (IPA) | 1973.56 |

---

## 4. Misceláneos / consumibles (pestaña **COSUMIBLES (2)**)

El nombre debe contener **CONSUMIB** o **COSUMIB** (como en el archivo actual: **COSUMIBLES (2)**).

### Encabezados (fila 8)

| A | B | C | … | E | F | G |
|---|---|---|-----|---|---|---|
| UNIDAD | MATERIAL | CANTIDAD | | UNIDAD | MATERIAL | CANTIDAD |

Hay **dos bloques** por fila (izquierda y derecha).

### Datos (desde fila 9)

| UNIDAD | MATERIAL | CANTIDAD |
|--------|----------|----------|
| unidad | Brochas | 0 |
| kilos | electrodos 3/32 | 0 |
| rollo | Fleje plastico 1/2 x 12mm | 2 |

Unidades habituales: `unidad`, `kilos`/`kg`, `rollo`, `mts`/`m`, `paquete`.

---

## Qué NO hacer

| Error | Consecuencia |
|-------|----------------|
| Poner tintas en una hoja “Hoja10” sin encabezado MATERIAL/MICRAS/ANCHO/KG | No se importan |
| Renombrar **TINTAS** a otro nombre sin “TINTAS” | La hoja puede ignorarse |
| Cambiar **MATERIAL** por otro texto en sustratos | Esa hoja se ignora |
| Guardar como `.xls` o CSV | Usar siempre **.xlsx** |
| Mezclar tipos en una sola pestaña sin el formato correcto | Solo se importa lo que coincida |

---

## Flujo recomendado

1. Descargar **Plantilla vacía** en Materiales.
2. Completar datos (o copiar desde el Excel actual de planta respetando pestañas y encabezados).
3. **Importar Excel** → revisar vista previa → **Confirmar importación**.
4. Verificar el listado en Materiales (pestañas Sustrato, Tintas, Químicos, Misceláneos).

---

## Mensaje corto para el equipo

> Para cargar inventario en Axones:
>
> - **Sustratos:** hojas con fila 1 = `MATERIAL | MICRAS | ANCHO | KG`
> - **Tintas:** pestaña **TINTAS**, columnas `COLOR | CÓDIGO | KG`
> - **Químicos:** pestaña **QUÍMICOS**, columnas `COD | MATERIAL | KG`
> - **Consumibles:** pestaña **COSUMIBLES (2)**, columnas `UNIDAD | MATERIAL | CANTIDAD`
>
> No cambien nombres de pestañas ni encabezados sin avisar a sistemas. El KG/CANTIDAD del Excel es el stock en el sistema.

---

## Soporte técnico

- Plantilla generada por la app: `plantilla-inventario-victor.xlsx`
- Archivo de referencia en planta: `INVENTARIO VICTOR.xlsx`
- Código del importador: `pulse-ui-react/src/lib/materials-victor-excel.ts`
