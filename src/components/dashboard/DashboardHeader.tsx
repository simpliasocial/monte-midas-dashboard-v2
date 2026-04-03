import { cn } from "@/lib/utils";
import { Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  className?: string;
}

export function DashboardHeader({ className }: DashboardHeaderProps) {
  return (
    <header className={cn("mb-8", className)}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Simplia Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground font-bold text-lg">S</span>
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                Dashboard de Desempeño
              </h1>
              <p className="text-sm text-muted-foreground">
                Agente Funnel Monte Midas
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Noviembre 2025</span>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Resultados del Funnel Conversacional IA – Análisis completo de rendimiento
      </p>
    </header>
  );
}
