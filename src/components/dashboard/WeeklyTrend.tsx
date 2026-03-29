import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

interface WeeklyTrendProps {
  data: Array<{
    week: string;
    leads: number;
    interesado: number;
    crear_confianza: number;
    crear_urgencia: number;
    cita_agendada: number;
    cita_agendada_jess: number;
    desinteresado: number;
    venta_exitosa: number;
  }>;
  className?: string;
}

const LABEL_COLORS: Record<string, { stroke: string; name: string }> = {
  leads: { stroke: "hsl(224, 62%, 32%)", name: "Leads (Total)" },
  interesado: { stroke: "hsl(260, 60%, 50%)", name: "interesado" },
  crear_confianza: { stroke: "hsl(142, 60%, 45%)", name: "crear_confianza" },
  crear_urgencia: { stroke: "hsl(142, 60%, 55%)", name: "crear_urgencia" },
  cita_agendada: { stroke: "hsl(45, 93%, 48%)", name: "cita_agendada" },
  cita_agendada_jess: { stroke: "hsl(35, 93%, 50%)", name: "cita_agendada_jess" },
  desinteresado: { stroke: "hsl(0, 70%, 60%)", name: "desinteresado" },
  venta_exitosa: { stroke: "hsl(160, 84%, 39%)", name: "venta_exitosa" },
};

export function WeeklyTrend({ data, className }: WeeklyTrendProps) {
  return (
    <div className={cn("h-56", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="week"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          {Object.entries(LABEL_COLORS).map(([key, { stroke, name }]) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={stroke}
              strokeWidth={key === "leads" ? 3 : 1.5}
              strokeDasharray={key === "leads" ? undefined : "4 2"}
              dot={{ fill: stroke, strokeWidth: 0, r: key === "leads" ? 4 : 3 }}
              name={name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
