import { useEffect, useState } from "react"
import Chart from "react-apexcharts"
import type { ApexOptions } from "apexcharts"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"

export function ApexDonutChart() {
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

  const options: ApexOptions = {
    chart: {
      type: "donut",
      background: "transparent",
    },

    theme: {
      mode: theme,
    },

    labels: ["Desktop", "Mobile", "Tablet", "Other"],

    legend: {
      position: "bottom",
      labels: {
        colors: theme === "dark" ? "#e5e7eb" : "#374151",
      },
    },

    dataLabels: {
      enabled: true,
    },

    tooltip: {
      theme: theme,
    },

    plotOptions: {
      pie: {
        donut: {
          size: "70%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total Users",
              fontSize: "14px",
              color: theme === "dark" ? "#e5e7eb" : "#374151",
              formatter: function (w) {
                const total = w.globals.seriesTotals.reduce(
                  (a: number, b: number) => a + b,
                  0
                )
                return total.toString()
              },
            },
          },
        },
      },
    },
  }

  const series = [5400, 7200, 2100, 900]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Traffic Sources
        </CardTitle>
        <CardDescription>
          Users by device type
        </CardDescription>
      </CardHeader>

      <CardContent className="flex justify-center">
        <Chart
          options={options}
          series={series}
          type="donut"
          width={380}
        />
      </CardContent>
    </Card>
  )
}
