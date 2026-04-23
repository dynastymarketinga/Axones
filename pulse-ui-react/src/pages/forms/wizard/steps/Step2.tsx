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

type Step2Props = {
  form: FormData
  setForm: React.Dispatch<React.SetStateAction<FormData>>
}

export default function Step2({ form, setForm }: Step2Props) {
  return (
    <div className="space-y-6 bg-background rounded-2xl shadow border p-8">

      <div>
        <h2 className="text-lg font-semibold">
          Additional Info
        </h2>
        <p className="text-sm text-muted-foreground">
          Please fill in your additional information below.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="space-y-2">
          <Label>Address</Label>
          <Input
            value={form.address || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, address: e.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>City</Label>
          <Input
            value={form.city || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, city: e.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>State</Label>
          <Input
            value={form.state || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, state: e.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Zip Code</Label>
          <Input
            value={form.zip || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, zip: e.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Occupation</Label>
          <Input
            value={form.occupation || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, occupation: e.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Company</Label>
          <Input
            value={form.company || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, company: e.target.value }))
            }
          />
        </div>

      </div>
    </div>
  )
}