import { useEffect, useState } from "react"
import Chart from "react-apexcharts"
import type { ApexOptions } from "apexcharts"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ApexKpiCards() {
  const [theme, setTheme] = useState<"light" | "dark">(
    document.documentElement.classList.contains("dark")
      ? "dark"
      : "light"
  )

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(
        document.documentElement.classList.contains("dark")
          ? "dark"
          : "light"
      )
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  const baseOptions: ApexOptions = {
    chart: {
      type: "radialBar",
      background: "transparent",
      sparkline: { enabled: true },
    },

    theme: {
      mode: theme,
    },

    plotOptions: {
      radialBar: {
        hollow: {
          size: "65%",
        },
        track: {
          background: theme === "dark" ? "#1f2937" : "#e5e7eb",
        },
        dataLabels: {
          name: {
            show: false,
          },
          value: {
            fontSize: "26px",
            fontWeight: 600,
            color: theme === "dark" ? "#ffffff" : "#111827",
            formatter: function (val) {
              return val + "%"
            },
          },
        },
      },
    },
  }

  const kpis = [
    { title: "Revenue", value: 76 },
    { title: "Sales", value: 63 },
    { title: "Growth", value: 89 },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {kpis.map((kpi, index) => (
        <Card key={index} className="rounded-2xl border bg-background shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              {kpi.title}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex justify-center">
            <Chart
              options={{ ...baseOptions, labels: [kpi.title] }}
              series={[kpi.value]}
              type="radialBar"
              height={250}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
