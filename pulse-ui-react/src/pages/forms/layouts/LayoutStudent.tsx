"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

// ✅ Types
type FormData = {
  firstName: string
  lastName: string
  email: string
  phone: string
  dob: string
  gender: string
  course: string
  address: string
  confirm: boolean
}

type FormErrors = Partial<Record<keyof FormData, string>>
type Touched = Partial<Record<keyof FormData, boolean>>

const initialState: FormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dob: "",
  gender: "",
  course: "",
  address: "",
  confirm: false,
}

export default function LayoutStudent() {
  const [form, setForm] = useState<FormData>(initialState)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Touched>({})

  // ✅ Validation
  const validate = (): FormErrors => {
    const newErrors: FormErrors = {}

    if (!form.firstName) newErrors.firstName = "First name is required"
    if (!form.lastName) newErrors.lastName = "Last name is required"

    if (!form.email) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = "Email is invalid"
    }

    if (!form.phone) newErrors.phone = "Phone number is required"
    if (!form.dob) newErrors.dob = "Date of birth is required"
    if (!form.gender) newErrors.gender = "Gender is required"
    if (!form.course) newErrors.course = "Course is required"
    if (!form.address) newErrors.address = "Address is required"
    if (!form.confirm) newErrors.confirm = "Please confirm your details"

    return newErrors
  }

  // ✅ Change handler
  const handleChange = <K extends keyof FormData>(
    name: K,
    value: FormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // ✅ Blur handler
  const handleBlur = (name: keyof FormData) => {
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors(validate())
  }

  // ✅ Submit handler
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const validationErrors = validate()
    setErrors(validationErrors)

    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      dob: true,
      gender: true,
      course: true,
      address: true,
      confirm: true,
    })

    if (Object.keys(validationErrors).length === 0) {
      alert("Form submitted successfully!")
      setForm(initialState)
      setTouched({})
    }
  }

  // ✅ Input style helper
  const inputStyle = (name: keyof FormData) =>
    touched[name] && errors[name]
      ? "border-red-500 focus-visible:ring-red-500"
      : ""

  return (
    <div className="flex justify-center py-10 px-4 min-h-screen">
      <Card className="w-full max-w-3xl rounded-2xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            🎓 Student Registration
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* First & Last Name */}
            <div className="grid md:grid-cols-2 gap-6">
              {(["firstName", "lastName"] as const).map((field) => (
                <div key={field} className="space-y-2">
                  <Label>
                    {field === "firstName" ? "First Name" : "Last Name"}
                  </Label>
                  <Input
                    placeholder={`Enter ${field === "firstName" ? "first" : "last"} name`}
                    value={form[field]}
                    onChange={(e) =>
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

            {/* Email */}
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="Enter email"
                value={form.email}
                onChange={(e) =>
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

            {/* Phone */}
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                type="tel"
                placeholder="Enter phone number"
                value={form.phone}
                onChange={(e) =>
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

            {/* DOB & Gender */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={form.dob}
                  onChange={(e) =>
                    handleChange("dob", e.target.value)
                  }
                  onBlur={() => handleBlur("dob")}
                  className={inputStyle("dob")}
                />
                {touched.dob && errors.dob && (
                  <p className="text-sm text-red-500">{errors.dob}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Gender</Label>
                <Select
                  onValueChange={(value) =>
                    handleChange("gender", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {touched.gender && errors.gender && (
                  <p className="text-sm text-red-500">{errors.gender}</p>
                )}
              </div>
            </div>

            {/* Course */}
            <div className="space-y-2">
              <Label>Course</Label>
              <Select
                onValueChange={(value) =>
                  handleChange("course", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bachelor of Science">Bachelor of Science</SelectItem>
                  <SelectItem value="Bachelor of Arts">Bachelor of Arts</SelectItem>
                  <SelectItem value="Bachelor of Commerce">Bachelor of Commerce</SelectItem>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              {touched.course && errors.course && (
                <p className="text-sm text-red-500">{errors.course}</p>
              )}
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                rows={3}
                placeholder="Enter full address"
                value={form.address}
                onChange={(e) =>
                  handleChange("address", e.target.value)
                }
                onBlur={() => handleBlur("address")}
                className={inputStyle("address")}
              />
              {touched.address && errors.address && (
                <p className="text-sm text-red-500">{errors.address}</p>
              )}
            </div>

            {/* Confirm */}
            <div className="flex items-start space-x-2">
              <Checkbox
                checked={form.confirm}
                onCheckedChange={(value) =>
                  handleChange("confirm", Boolean(value))
                }
              />
              <Label className="text-sm font-normal">
                I confirm that the above details are correct
              </Label>
            </div>
            {touched.confirm && errors.confirm && (
              <p className="text-sm text-red-500">{errors.confirm}</p>
            )}

            <Button type="submit" className="w-full font-semibold">
              Register
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  )
}