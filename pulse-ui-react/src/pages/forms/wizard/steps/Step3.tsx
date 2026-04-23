"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type FormData = {
  firstName: string
  lastName: string
  phone: string
  email: string
  country: string
  language: string
  address: string
  city: string
  state: string
  zip: string
  occupation: string
  company: string
  cardNumber: string
  cardHolder: string
  expiry: string
  cvv: string
  comments: string
}

type Step3Props = {
  form: FormData
  setForm: React.Dispatch<React.SetStateAction<FormData>>
}

export default function Step3({ form, setForm }: Step3Props) {
  return (
    <div className="space-y-6 bg-background rounded-2xl shadow border p-8">

      <div>
        <h2 className="text-lg font-semibold">
          Payment Information
        </h2>
        <p className="text-sm text-muted-foreground">
          Enter your card details to complete the payment.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Card Number */}
        <div className="space-y-2 md:col-span-2">
          <Label>Card Number</Label>
          <Input
            placeholder="1234 5678 9012 3456"
            value={form.cardNumber || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                cardNumber: e.target.value,
              }))
            }
          />
        </div>

        {/* Card Holder */}
        <div className="space-y-2 md:col-span-2">
          <Label>Card Holder Name</Label>
          <Input
            placeholder="John Doe"
            value={form.cardHolder || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                cardHolder: e.target.value,
              }))
            }
          />
        </div>

        {/* Expiry */}
        <div className="space-y-2">
          <Label>Expiry Date</Label>
          <Input
            placeholder="MM/YY"
            value={form.expiry || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                expiry: e.target.value,
              }))
            }
          />
        </div>

        {/* CVV */}
        <div className="space-y-2">
          <Label>CVV</Label>
          <Input
            type="password"
            placeholder="123"
            value={form.cvv || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                cvv: e.target.value,
              }))
            }
          />
        </div>

      </div>
    </div>
  )
}