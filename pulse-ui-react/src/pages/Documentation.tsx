import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText } from "lucide-react"

export default function Documentation() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documentación</h1>
        <p className="text-muted-foreground">Material interno y procedimientos de Axones (no público).</p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Uso del sistema
          </CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-sm text-muted-foreground">
            Guías operativas y decisiones técnicas las mantiene el responsable de sistema. Pida acceso
            a la carpeta o manual corporativo de su planta.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
