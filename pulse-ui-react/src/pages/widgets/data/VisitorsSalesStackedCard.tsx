import { useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { cn } from "@/lib/utils"
import { CircleCheckBig, OctagonX, ShieldHalf } from "lucide-react"

const chartData = {
  weekly: [
    { label: "Mon", visitors: 40, sales: 60 },
    { label: "Tue", visitors: 55, sales: 75 },
    { label: "Wed", visitors: 50, sales: 70 },
    { label: "Thu", visitors: 65, sales: 90 },
    { label: "Fri", visitors: 70, sales: 95 },
    { label: "Sat", visitors: 60, sales: 80 },
    { label: "Sun", visitors: 75, sales: 110 },
  ],
  monthly: [
    { label: "Jan", visitors: 80, sales: 120 },
    { label: "Feb", visitors: 100, sales: 180 },
    { label: "Mar", visitors: 70, sales: 140 },
    { label: "Apr", visitors: 130, sales: 220 },
    { label: "May", visitors: 120, sales: 200 },
    { label: "Jun", visitors: 150, sales: 260 },
    { label: "Jul", visitors: 130, sales: 230 },
    { label: "Aug", visitors: 170, sales: 300 },
    { label: "Sep", visitors: 140, sales: 250 },
    { label: "Oct", visitors: 190, sales: 340 },
    { label: "Nov", visitors: 160, sales: 290 },
    { label: "Dec", visitors: 200, sales: 360 },
  ],
  yearly: [
    { label: "2021", visitors: 1200, sales: 1800 },
    { label: "2022", visitors: 1500, sales: 2300 },
    { label: "2023", visitors: 1800, sales: 2900 },
    { label: "2024", visitors: 2100, sales: 3400 },
    { label: "2025", visitors: 2400, sales: 3900 },
  ],
}

type Range = "weekly" | "monthly" | "yearly"

export default function VisitorsSalesStackedCard() {
  const [range, setRange] = useState<Range>("monthly")

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap gap-3 items-center justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">
            Visitors / Sales
          </CardTitle>
          <p className="text-sm text-emerald-600">
            ↑ 2.5% vs last period
          </p>
        </div>

        {/* Toggle */}
        <div className="flex gap-1 rounded-lg border p-1">
          {(["weekly", "monthly", "yearly"] as Range[]).map((item) => (
            <Button
              key={item}
              size="sm"
              variant="ghost"
              className={cn(
                "capitalize",
                range === item && "bg-muted font-semibold"
              )}
              onClick={() => setRange(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData[range]} barGap={6} barSize={30} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                className="text-xs"
                tickMargin={10}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                className="text-xs"
              />
              <Tooltip cursor={{ fill: "transparent" }} />

              {/* Visitors */}
              <Bar
                dataKey="visitors"
                stackId="a"
                fill="#f59e0b"
                radius={[0, 0, 6, 6]}
                name="Visitors"
              />

              {/* Sales */}
              <Bar
                dataKey="sales"
                stackId="a"
                fill="#6366f1"
                radius={[6, 6, 0, 0]}
                name="Sales"

              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="mt-4 flex justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-amber-500" />
            Visitors
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-indigo-500" />
            Sales
          </div>
        </div>
         {/* Stats */}
                <div className="mt-8 space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400 border-green-500/30">
                                <CircleCheckBig className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Completed Orders</p>
                                <p className="text-xs text-muted-foreground">Last 7 days</p>
                            </div>
                        </div>
                        <span className="text-sm font-medium text-green-600">+128</span>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400 border-yellow-500/30">
                                <ShieldHalf className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Processing Orders</p>
                                <p className="text-xs text-muted-foreground">Currently active</p>
                            </div>
                        </div>
                        <span className="text-sm font-medium text-yellow-600">46</span>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-500 dark:bg-red-500/20 dark:text-red-400 border-red-500/30">
                                <OctagonX className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Cancelled / Refunded</p>
                                <p className="text-xs text-muted-foreground">Last 7 days</p>
                            </div>
                        </div>
                        <span className="text-sm font-medium text-red-500">-12</span>
                    </div>
                </div>
      </CardContent>
    </Card>
  )
}
