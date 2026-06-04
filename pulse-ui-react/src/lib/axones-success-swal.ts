import Swal from "sweetalert2"
import "sweetalert2/dist/sweetalert2.min.css"

const AXONES_SWAL_CONFIRM_COLOR = "#7c3aed"

type AxonesSuccessSwalOptions = {
  html?: string
}

/** Modal de éxito estilo SweetAlert (centrado, requiere confirmar). */
export function showAxonesSuccessSwal(
  title: string,
  text?: string,
  options?: AxonesSuccessSwalOptions,
): Promise<void> {
  const html = options?.html?.trim()
  const body = text?.trim()
  return Swal.fire({
    icon: "success",
    title,
    ...(html ? { html } : body ? { text: body } : {}),
    confirmButtonText: "Entendido",
    confirmButtonColor: AXONES_SWAL_CONFIRM_COLOR,
    buttonsStyling: true,
    heightAuto: false,
  }).then(() => undefined)
}
