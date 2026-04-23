import { create } from "zustand"

type UIThemeState = {
  theme: string
  setTheme: (theme: string) => void
}

export const useUIThemeStore = create<UIThemeState>((set) => ({
  theme: localStorage.getItem("ui-theme") || "",

  setTheme: (theme) => {
    localStorage.setItem("ui-theme", theme)

    // force update (important)
    set({ theme: "" })

    setTimeout(() => {
      set({ theme })
    }, 0)
  },
}))