import { cn } from "@/lib/utils";

interface ResponseTimeGaugeProps {
  value: number;
  className?: string;
}

export function ResponseTimeGauge({ value, className }: ResponseTimeGaugeProps) {
  const getStatus = (val: number) => {
    if (val <= 3) return { color: "text-success", bg: "bg-success", label: "Excelente", ringColor: "stroke-success" };
    if (val <= 6) return { color: "text-warning", bg: "bg-warning", label: "Aceptable", ringColor: "stroke-warning" };
    return { color: "text-destructive", bg: "bg-destructive", label: "Crítico", ringColor: "stroke-destructive" };
  };

  const status = getStatus(value);
  const maxValue = 12; // Adjusted max value for the gauge scale
  const percentage = Math.min((value / maxValue) * 100, 100);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference * 0.75;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative w-40 h-40">
        <svg className="w-full h-full transform -rotate-135" viewBox="0 0 100 100">
          {/* Background arc */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * 0.25}
          />
          {/* Progress arc */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            className={cn("transition-all duration-1000 ease-out", status.ringColor)}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-4xl font-bold font-display", status.color)}>
            {value.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">min</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className={cn("w-2 h-2 rounded-full", status.bg)} />
        <span className={cn("text-sm font-medium", status.color)}>{status.label}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground text-center">
        SLA esperado ≤6 min
      </p>
    </div>
  );
}
