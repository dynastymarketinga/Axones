"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { Badge } from "@/components/ui/badge"

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly")

  const prices = {
    free: { monthly: 0, yearly: 0 },
    tiny: { monthly: 5, yearly: 50 },
    solo: { monthly: 13, yearly: 130 },
    pro: { monthly: 31, yearly: 310 },
  }

  const period = billing === "monthly" ? "mo" : "yr"

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-3">
          Upgrade for More
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Upgrade to link your custom domain, track visits, edit content & unlock premium features.
        </p>

        {/* Billing Toggle */}
        <div className="mt-6 flex justify-center">
          <ToggleGroup
            type="single"
            value={billing}
            onValueChange={(value) => value && setBilling(value as "monthly" | "yearly")}
            className="border rounded-lg p-1"
          >
            <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
            <ToggleGroupItem value="yearly">Yearly</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">

        {/* Free */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle>Free</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">
              ${prices.free[billing]}{" "}
              <span className="text-sm text-muted-foreground">/{period}</span>
            </div>

            <p className="text-muted-foreground mb-6">
              Try us out for a quick project or two
            </p>

            <Button variant="secondary" className="w-full mb-6">
              Get Started
            </Button>

            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" /> 1 active project
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" /> 3 MB upload limit
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" /> 5,000 visitors /mo
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Tiny */}
        <Card className="border-primary shadow-md flex flex-col justify-between">
          <CardHeader>
            <CardTitle>Tiny</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary mb-2">
              ${prices.tiny[billing]}{" "}
              <span className="text-sm text-muted-foreground">/{period}</span>
              {billing === "yearly" && (
                <span className="text-xs text-green-500 ml-2">Save 20%</span>
              )}
            </div>

            <p className="text-muted-foreground mb-6">
              Perfect for a professional link
            </p>

            <Button className="w-full mb-6">Get Started</Button>

            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 1 active project</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 25 MB upload limit</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 10,000 visitors /mo</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> QR Codes</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Built-in analytics</li>
            </ul>
          </CardContent>
        </Card>

        {/* Solo */}
        <Card className="relative border-2 border-purple-500 shadow-xl flex flex-col justify-between">
          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
            Most Popular
          </Badge>

          <CardHeader>
            <CardTitle>Solo</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="text-3xl font-bold text-purple-600 mb-2">
              ${prices.solo[billing]}{" "}
              <span className="text-sm text-muted-foreground">/{period}</span>
              {billing === "yearly" && (
                <span className="text-xs text-green-500 ml-2">Save 20%</span>
              )}
            </div>

            <p className="text-muted-foreground mb-6">
              Great for individuals & small projects
            </p>

            <Button variant="outline" className="w-full mb-6">
              Get Started
            </Button>

            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 5 active projects</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 75 MB upload limit</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 100,000 visitors /mo</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Custom domains</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Password protection</li>
            </ul>
          </CardContent>
        </Card>

        {/* Pro */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle>Pro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-500 mb-2">
              ${prices.pro[billing]}{" "}
              <span className="text-sm text-muted-foreground">/{period}</span>
              {billing === "yearly" && (
                <span className="text-xs text-green-500 ml-2">Save 20%</span>
              )}
            </div>

            <p className="text-muted-foreground mb-6">
              For freelancers & agencies
            </p>

            <Button className="w-full mb-6">Get Started</Button>

            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Unlimited projects</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 10 GB upload</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 500,000 visitors /mo</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Capture emails</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Team members</li>
            </ul>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}