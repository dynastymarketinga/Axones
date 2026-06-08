import * as React from "react"

/** Evita ráfagas cuando varios hooks escuchan el mismo evento (p. ej. alerts:refresh). */
export function useDebouncedWindowEvent(
  eventName: string,
  handler: () => void,
  delayMs = 400,
) {
  const handlerRef = React.useRef(handler)
  handlerRef.current = handler

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const fn = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        handlerRef.current()
      }, delayMs)
    }
    window.addEventListener(eventName, fn)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener(eventName, fn)
    }
  }, [delayMs, eventName])
}
