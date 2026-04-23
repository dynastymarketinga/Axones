import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts"

const visitorsData = [
  { value: 20 },
  { value: 35 },
  { value: 25 },
  { value: 60 },
  { value: 15 },
  { value: 75 },
  { value: 30 },
]

export default function WebsiteVisitorsCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-md font-semibold text-muted-foreground">
          Website Visitors
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold mb-2">43K</h2>
          <p className="text-md text-emerald-600">
            +5.6% from last week
          </p>
        </div>

        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visitorsData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke="#6366f1"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
