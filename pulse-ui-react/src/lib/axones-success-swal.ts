import Swal, { type SweetAlertIcon } from "sweetalert2"
import "sweetalert2/dist/sweetalert2.min.css"

/** Tono visual del modal (color del botón confirmar). */
export type AxonesSwalTone =
  | "guardado"
  | "timer"
  | "warehouse"
  | "turno"
  | "finalizado"
  | "control"
  | "sync"

const AXONES_SWAL_TONE_CONFIG: Record<
  AxonesSwalTone,
  { confirmButtonColor: string; icon: SweetAlertIcon }
> = {
  guardado: { confirmButtonColor: "#7c3aed", icon: "success" },
  timer: { confirmButtonColor: "#059669", icon: "success" },
  warehouse: { confirmButtonColor: "#0284c7", icon: "success" },
  turno: { confirmButtonColor: "#0d9488", icon: "success" },
  finalizado: { confirmButtonColor: "#4338ca", icon: "success" },
  control: { confirmButtonColor: "#6366f1", icon: "info" },
  sync: { confirmButtonColor: "#0891b2", icon: "info" },
}

type AxonesSuccessSwalOptions = {
  html?: string
  tone?: AxonesSwalTone
}

/** Modal de éxito estilo SweetAlert (centrado, requiere confirmar). */
export function showAxonesSuccessSwal(
  title: string,
  text?: string,
  options?: AxonesSuccessSwalOptions,
): Promise<void> {
  const html = options?.html?.trim()
  const body = text?.trim()
  const tone = options?.tone ?? "guardado"
  const cfg = AXONES_SWAL_TONE_CONFIG[tone]
  return Swal.fire({
    icon: cfg.icon,
    title,
    ...(html ? { html } : body ? { text: body } : {}),
    confirmButtonText: "Entendido",
    confirmButtonColor: cfg.confirmButtonColor,
    buttonsStyling: true,
    heightAuto: false,
  }).then(() => undefined)
}
