import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  BarChart,
  Bar,
  ResponsiveContainer,
} from "recharts"

const customersData = [
  { value: 20 },
  { value: 45 },
  { value: 30 },
  { value: 60 },
  { value: 25 },
  { value: 75 },
  { value: 55 },
]

export default function NewCustomersCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-md font-semibold text-muted-foreground">
          New Customers
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold mb-2">1.2K</h2>
          <p className="text-md text-emerald-600">
            +3.2% from last week
          </p>
        </div>

        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={customersData}>
              <Bar
                dataKey="value"
                radius={[6, 6, 0, 0]}
                fill="#3b82f6"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
