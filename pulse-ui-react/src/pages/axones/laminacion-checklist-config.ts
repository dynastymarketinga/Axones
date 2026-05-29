/** Ítems de lista de chequeo — espejo de public/laminacion.html */
export const LAM_CHECKLIST_ITEMS: { id: string; text: string }[] = [
  { id: "1", text: "Tener y revisar Orden de Trabajo (O.T.)" },
  {
    id: "2",
    text: "Verificar y chequear que estén encendidos: el Chiller y el Compresor de aire para luego encender la máquina",
  },
  {
    id: "3",
    text: "Chequear materia prima: Material impreso, Material virgen, Tipo de material, Ancho, Micraje, Solvente, Adhesivo-Catalizador, Insumos",
  },
  { id: "4", text: "Preparación revisar: Camisas, Obturadores, Calibrar grupo laminador" },
  {
    id: "5",
    text: "Chequear con el lápiz tratador cada bobina virgen que monte en la bilamina - trilamina siempre laminando por la cara tratada",
  },
  {
    id: "6",
    text: "En el arranque y durante el proceso realizar pruebas de gramajes uno por cada bobina laminada",
  },
  { id: "7", text: "Revisar radio de mezcla adhesivo 100-60 catalizador dependiendo del proveedor" },
  {
    id: "8",
    text: "Mantener camisas, grupo laminador, obturadores, rodillos guías siempre limpios y en buenas condiciones",
  },
  {
    id: "9",
    text: "Durante el proceso chequear la muestra laminada: Apariencia, Curling, Piel de naranja",
  },
  { id: "10", text: "Chequear y verificar que el tratador corona esté en funcionamiento cuando se amerite" },
  {
    id: "11",
    text: "Verificar y chequear que los ductos de los gases de ozono estén en buen funcionamiento",
  },
  { id: "12", text: "Tener los cores a utilizar acorde con el ancho de los materiales" },
  { id: "13", text: "Participar cuando la laminadora presente algunas fallas" },
  { id: "14", text: "Segregar material con falla de impresión antes de laminar" },
]

export type LamChecklistEstado = "" | "aprobado" | "rechazado"

export function parseLamChecklistChecked(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x).trim()).filter(Boolean)
}
