import { DataTable } from "@/components/data-table"
import { columns } from "@/components/columns"
import { data } from "./data"

export default function DataTablePage() {
  return (
    <div className="data-table-page border rounded-xl p-6 shadow">
      <DataTable columns={columns} data={data} />
    </div>
  )
}