"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

type Step1Props = {
  form: FormData
  setForm: React.Dispatch<React.SetStateAction<FormData>>
}

export default function Step1({ form, setForm }: Step1Props) {
  return (
    <div className="space-y-6 bg-background rounded-2xl shadow border p-8">

      <div>
        <h2 className="text-lg font-semibold">
          Personal Details
        </h2>
        <p className="text-sm text-muted-foreground">
          Please fill in your personal details below.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="space-y-2">
          <Label>First Name</Label>
          <Input
            value={form.firstName || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, firstName: e.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Last Name</Label>
          <Input
            value={form.lastName || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, lastName: e.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Phone Number</Label>
          <Input
            value={form.phone || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>E-mail Address</Label>
          <Input
            type="email"
            value={form.email || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Country</Label>
          <Select
            value={form.country || ""}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, country: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="---" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="india">India</SelectItem>
              <SelectItem value="usa">United States</SelectItem>
              <SelectItem value="uk">United Kingdom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Language</Label>
          <Select
            value={form.language || ""}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, language: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="---" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="english">English</SelectItem>
              <SelectItem value="hindi">Hindi</SelectItem>
              <SelectItem value="spanish">Spanish</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </div>
    </div>
  )
}