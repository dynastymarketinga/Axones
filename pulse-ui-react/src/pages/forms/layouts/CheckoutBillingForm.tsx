"use client"

import { useState, ChangeEvent, FormEvent } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Define the shape of your form data
interface FormState {
  fullName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  country: string
  paymentMethod: string
  cardNumber: string
  expiry: string
  cvv: string
  saveDetails: boolean
}

const initialState: FormState = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  country: "",
  paymentMethod: "",
  cardNumber: "",
  expiry: "",
  cvv: "",
  saveDetails: false,
}

export default function CheckoutBillingForm() {
  const [form, setForm] = useState<FormState>(initialState)
  // Use Record<string, string> instead of any for dynamic keys
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!form.fullName) newErrors.fullName = "Full name is required"

    if (!form.email) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = "Email is invalid"
    }

    if (!form.phone) newErrors.phone = "Phone number is required"
    if (!form.address) newErrors.address = "Street address is required"
    if (!form.city) newErrors.city = "City is required"
    if (!form.state) newErrors.state = "State is required"
    if (!form.zip) newErrors.zip = "Zip code is required"
    if (!form.country) newErrors.country = "Country is required"
    if (!form.paymentMethod)
      newErrors.paymentMethod = "Payment method is required"

    if (
      form.paymentMethod === "Credit Card" ||
      form.paymentMethod === "Debit Card"
    ) {
      if (!form.cardNumber) newErrors.cardNumber = "Card number is required"
      if (!form.expiry) newErrors.expiry = "Expiry is required"
      if (!form.cvv) newErrors.cvv = "CVV is required"
    }

    return newErrors
  }

  // value is typed as string | boolean to cover both Inputs and Checkboxes
  const handleChange = (name: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleBlur = (name: keyof FormState) => {
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors(validate())
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const validationErrors = validate()
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length === 0) {
      alert("Purchase completed!")
      setForm(initialState)
      setTouched({})
    }
  }

  const inputStyle = (name: keyof FormState) =>
    touched[name] && errors[name]
      ? "border-red-500 focus-visible:ring-red-500"
      : ""

  return (
    <div className="flex justify-center py-10 px-4">
      <Card className="w-full max-w-4xl rounded-2xl shadow-lg">
        <CardHeader className="border-b">
          <CardTitle className="text-2xl font-bold text-center">
            🧾 Checkout - Billing Details
          </CardTitle>
        </CardHeader>

        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Full Name */}
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                placeholder="Enter your full name"
                value={form.fullName}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleChange("fullName", e.target.value)
                }
                onBlur={() => handleBlur("fullName")}
                className={inputStyle("fullName")}
              />
              {touched.fullName && errors.fullName && (
                <p className="text-sm text-red-500">
                  {errors.fullName}
                </p>
              )}
            </div>

            {/* Email + Phone */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={form.email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    handleChange("email", e.target.value)
                  }
                  onBlur={() => handleBlur("email")}
                  className={inputStyle("email")}
                />
                {touched.email && errors.email && (
                  <p className="text-sm text-red-500">
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="+91 9876543210"
                  value={form.phone}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    handleChange("phone", e.target.value)
                  }
                  onBlur={() => handleBlur("phone")}
                  className={inputStyle("phone")}
                />
                {touched.phone && errors.phone && (
                  <p className="text-sm text-red-500">
                    {errors.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label>Street Address</Label>
              <Input
                placeholder="123 Main St"
                value={form.address}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleChange("address", e.target.value)
                }
                onBlur={() => handleBlur("address")}
                className={inputStyle("address")}
              />
              {touched.address && errors.address && (
                <p className="text-sm text-red-500">
                  {errors.address}
                </p>
              )}
            </div>

            {/* City / State / Zip */}
            <div className="grid md:grid-cols-3 gap-6">
              {(["city", "state", "zip"] as const).map((field) => (
                <div key={field} className="space-y-2">
                  <Label className="capitalize">
                    {field}
                  </Label>
                  <Input
                    placeholder={`Enter ${field}`}
                    value={form[field]}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleChange(field, e.target.value)
                    }
                    onBlur={() => handleBlur(field)}
                    className={inputStyle(field)}
                  />
                  {touched[field] && errors[field] && (
                    <p className="text-sm text-red-500">
                      {errors[field]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Country */}
            <div className="space-y-2">
              <Label>Country</Label>
              <Select
                value={form.country}
                onValueChange={(value) =>
                  handleChange("country", value)
                }
              >
                <SelectTrigger onBlur={() => handleBlur("country")}>
                  <SelectValue placeholder="Select Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="India">India</SelectItem>
                  <SelectItem value="United States">United States</SelectItem>
                  <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                  <SelectItem value="Canada">Canada</SelectItem>
                  <SelectItem value="Australia">Australia</SelectItem>
                </SelectContent>
              </Select>
              {touched.country && errors.country && (
                <p className="text-sm text-red-500">
                  {errors.country}
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(value) =>
                  handleChange("paymentMethod", value)
                }
              >
                <SelectTrigger onBlur={() => handleBlur("paymentMethod")}>
                  <SelectValue placeholder="Select Payment Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Debit Card">Debit Card</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Net Banking">Net Banking</SelectItem>
                  <SelectItem value="COD">Cash on Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Card Details */}
            {(form.paymentMethod === "Credit Card" ||
              form.paymentMethod === "Debit Card") && (
              <div className="grid md:grid-cols-3 gap-6">
                <Input
                  placeholder="Card Number"
                  value={form.cardNumber}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    handleChange("cardNumber", e.target.value)
                  }
                  onBlur={() => handleBlur("cardNumber")}
                />
                <Input
                  placeholder="MM/YY"
                  value={form.expiry}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    handleChange("expiry", e.target.value)
                  }
                  onBlur={() => handleBlur("expiry")}
                />
                <Input
                  type="password"
                  placeholder="CVV"
                  value={form.cvv}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    handleChange("cvv", e.target.value)
                  }
                  onBlur={() => handleBlur("cvv")}
                />
              </div>
            )}

            {/* Save Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="saveDetails"
                checked={form.saveDetails}
                onCheckedChange={(checked: boolean) =>
                  handleChange("saveDetails", checked)
                }
              />
              <Label htmlFor="saveDetails">Save my details for future checkout</Label>
            </div>

            <Button type="submit" className="w-full font-semibold">
              Complete Purchase
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}