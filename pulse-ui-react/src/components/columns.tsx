import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"

type Member = {
  name: string
  email: string
  role: string
  status: string
}

export const columns: ColumnDef<Member>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "role",
    header: "Role",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={
          row.original.status === "Active"
            ? "bg-green-500/10 text-green-600"
            : "bg-muted"
        }
      >
        {row.original.status}
      </Badge>
    ),
  },
]