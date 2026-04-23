import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts"

const areaData = [
  { value: 30 },
  { value: 45 },
  { value: 35 },
  { value: 65 },
  { value: 40 },
  { value: 80 },
  { value: 50 },
]

export default function AreaStatsCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-md font-semibold text-muted-foreground">
          Total Revenue
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold mb-2">$18.4K</h2>
          <p className="text-md text-emerald-600">
            +7.8% from last week
          </p>
        </div>

        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={areaData}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>

              <Area
                type="monotone"
                dataKey="value"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#areaGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
