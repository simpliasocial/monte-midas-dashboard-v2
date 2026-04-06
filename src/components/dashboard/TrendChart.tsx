import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

interface TrendChartProps {
  data: Array<{
    date: string;
    leads: number;
    sqls: number;
    citas: number;
  }>;
  className?: string;
}

export function TrendChart({ data, className }: TrendChartProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(224, 62%, 32%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(224, 62%, 32%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorSQLs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(45, 93%, 58%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(45, 93%, 58%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCitas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="leads"
              stroke="hsl(224, 62%, 32%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorLeads)"
              name="Leads"
            />
            <Area
              type="monotone"
              dataKey="sqls"
              stroke="hsl(45, 93%, 58%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorSQLs)"
              name="Interesados"
            />
            <Area
              type="monotone"
              dataKey="citas"
              stroke="hsl(142, 71%, 45%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCitas)"
              name="Agenda Cita"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
