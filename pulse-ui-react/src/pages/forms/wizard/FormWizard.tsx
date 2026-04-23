"use client"

import { ReactNode } from "react"
import { useWizard } from "./WizardContext"
import { Button } from "@/components/ui/button"
import StepProgress from "./StepProgress"

type FormWizardProps = {
  children: ReactNode[]
}

export default function FormWizard({ children }: FormWizardProps) {
  const { step, next, back } = useWizard()

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">

      {/* Stepper */}
      <StepProgress currentStep={step} />

      {/* Render Step */}
      <div>{children[step - 1]}</div>

      {/* Controls */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={back} disabled={step === 1}>
          Back
        </Button>
        <Button onClick={next}>
          {step === 4 ? "Finish" : "Next"}
        </Button>
      </div>

    </div>
  )
}