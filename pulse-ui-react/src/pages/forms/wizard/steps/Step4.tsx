"use client"

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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

type Step4Props = {
  form: FormData
  setForm: React.Dispatch<React.SetStateAction<FormData>>
}

export default function Step4({ form, setForm }: Step4Props) {
  const [agree, setAgree] = useState(false)

  return (
    <div className="space-y-8 bg-background rounded-2xl shadow border p-8">
      
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Review & Confirm</h2>
        <p className="text-sm text-muted-foreground">
          Please review your details before submitting.
        </p>
      </div>

      {/* Review Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><span className="font-medium">First Name:</span> {form.firstName}</div>
        <div><span className="font-medium">Last Name:</span> {form.lastName}</div>
        <div><span className="font-medium">Email:</span> {form.email}</div>
        <div><span className="font-medium">Phone:</span> {form.phone}</div>
        <div><span className="font-medium">Address:</span> {form.address}</div>
        <div><span className="font-medium">City:</span> {form.city}</div>
        <div><span className="font-medium">State:</span> {form.state}</div>
        <div><span className="font-medium">Zip:</span> {form.zip}</div>
        <div>
          <span className="font-medium">Card Number:</span>{" "}
          **** **** **** {form.cardNumber?.slice(-4)}
        </div>
      </div>

      {/* Comments */}
      <div className="space-y-2">
        <Label>Additional Comments</Label>
        <Textarea
          placeholder="Any final comments?"
          value={form.comments || ""}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, comments: e.target.value }))
          }
        />
      </div>

      {/* Agreement */}
      <div className="flex items-start space-x-3">
        <Checkbox
          checked={agree}
          onCheckedChange={(checked) => setAgree(checked === true)}
        />
        <Label className="text-sm leading-none">
          I agree to the Terms and Conditions
        </Label>
      </div>

    </div>
  )
}