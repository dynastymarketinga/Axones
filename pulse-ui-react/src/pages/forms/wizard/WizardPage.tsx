"use client"

import { useState } from "react"
import { WizardProvider } from "./WizardContext"
import FormWizard from "./FormWizard"
import Step1 from "./steps/Step1"
import Step2 from "./steps/Step2"
import Step3 from "./steps/Step3"
import Step4 from "./steps/Step4"

// ✅ SINGLE SOURCE OF TRUTH (VERY IMPORTANT)
export type FormData = {
  // Step 1
  firstName: string
  lastName: string
  phone: string
  email: string
  country: string
  language: string

  // Step 2
  address: string
  city: string
  state: string
  zip: string
  occupation: string
  company: string

  // Step 3
  cardNumber: string
  cardHolder: string
  expiry: string
  cvv: string

  // Step 4
  comments: string
}

export default function WizardPage() {
  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    country: "",
    language: "",

    address: "",
    city: "",
    state: "",
    zip: "",
    occupation: "",
    company: "",

    cardNumber: "",
    cardHolder: "",
    expiry: "",
    cvv: "",

    comments: "",
  })

  return (
    <WizardProvider>
      <FormWizard>
        <Step1 form={form} setForm={setForm} />
        <Step2 form={form} setForm={setForm} />
        <Step3 form={form} setForm={setForm} />
        <Step4 form={form} setForm={setForm} />
      </FormWizard>
    </WizardProvider>
  )
}