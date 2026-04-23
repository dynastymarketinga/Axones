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

const sessionsData = [
  { value: 30 },
  { value: 45 },
  { value: 20 },
  { value: 60 },
  { value: 40 },
  { value: 70 },
  { value: 50 },
]

export default function TotalSessionsCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-md font-semibold text-muted-foreground">
          Total Sessions
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold mb-2">4.5K</h2>
          <p className="text-md text-emerald-600">
            +8.2% from last week
          </p>
        </div>

        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sessionsData}>
              <Line
                type="linear"
                dataKey="value"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{
                  r: 4,
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
