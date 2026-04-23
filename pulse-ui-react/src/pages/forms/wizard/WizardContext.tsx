"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"

// 1. Define types
type WizardContextType = {
  step: number
  next: () => void
  back: () => void
  goTo: (step: number) => void
}

type WizardProviderProps = {
  children: ReactNode
}

// 2. Create the Context (Internal only)
const WizardContext = createContext<WizardContextType | undefined>(undefined)

// 3. Export the Provider
export function WizardProvider({ children }: WizardProviderProps) {
  const [step, setStep] = useState<number>(1)

  const next = () => setStep((s) => Math.min(s + 1, 4))
  const back = () => setStep((s) => Math.max(s - 1, 1))
  const goTo = (s: number) => setStep(s)

  return (
    <WizardContext.Provider value={{ step, next, back, goTo }}>
      {children}
    </WizardContext.Provider>
  )
}

// 4. Export the Hook
export function useWizard() {
  const context = useContext(WizardContext)

  if (!context) {
    throw new Error("useWizard must be used within a WizardProvider")
  }

  return context
}