import { Users, Target, Calendar, TrendingUp, Zap, Database, Clock, MessageSquare, AlertTriangle, CheckCircle, Filter, BarChart3, LogOut, DollarSign, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KPICard } from "@/components/dashboard/KPICard";
import { FunnelChart } from "@/components/dashboard/FunnelChart";
import { ResponseTimeGauge } from "@/components/dashboard/ResponseTimeGauge";
import { ChannelBreakdown } from "@/components/dashboard/ChannelBreakdown";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { DataCaptureChart } from "@/components/dashboard/DataCaptureChart";
import { WeeklyTrend } from "@/components/dashboard/WeeklyTrend";
import { RecentAppointments } from "@/components/dashboard/RecentAppointments";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Loader2 } from "lucide-react";

import { SectionCard } from "@/components/dashboard/SectionCard";

// Mock data based on User's Script Context
const monthlyTrendData = [
  { date: "Sem 1", leads: 200, sqls: 80, citas: 20 },
  { date: "Sem 2", leads: 250, sqls: 100, citas: 25 },
  { date: "Sem 3", leads: 280, sqls: 110, citas: 28 },
  { date: "Sem 4", leads: 270, sqls: 110, citas: 27 },
];
const ALL_TIME_VALUE = "-1";

const Index = () => {
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null); // null means "All Time"
  const [selectedWeek, setSelectedWeek] = useState<string>("1");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const { loading, error, data, refetch } = useDashboardData(selectedMonth, selectedWeek);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">
        Error loading dashboard data: {error}
      </div>
    );
  }

  const { kpis, funnelData, recentAppointments, channelData, weeklyTrend, monthlyTrend, disqualificationReasons, dataCapture, responseTime, availableChannels, conversationsWithChannel } = data;

  // Compute filtered funnel data based on selected channel
  const filteredFunnelData = (() => {
    if (selectedChannel === "all") return funnelData;

    const filtered = conversationsWithChannel.filter(
      (c: any) => c._channelName === selectedChannel
    );
    const total = filtered.length;

    const countLabel = (label: string) =>
      filtered.filter((c: any) => c.labels && c.labels.includes(label)).length;

    return [
      { label: "Interesado", value: countLabel('interesado'), percentage: total > 0 ? Math.round((countLabel('interesado') / total) * 100) : 0, color: "hsl(224, 62%, 32%)" },
      { label: "Crear Confianza", value: countLabel('crear_confianza'), percentage: total > 0 ? Math.round((countLabel('crear_confianza') / total) * 100) : 0, color: "hsl(142, 60%, 45%)" },
      { label: "Crear Urgencia", value: countLabel('crear_urgencia'), percentage: total > 0 ? Math.round((countLabel('crear_urgencia') / total) * 100) : 0, color: "hsl(142, 60%, 55%)" },
      { label: "Cita Agendada", value: countLabel('cita_agendada'), percentage: total > 0 ? Math.round((countLabel('cita_agendada') / total) * 100) : 0, color: "hsl(45, 93%, 58%)" },
      { label: "Cita Agendada Jess", value: countLabel('cita_agendada_jess'), percentage: total > 0 ? Math.round((countLabel('cita_agendada_jess') / total) * 100) : 0, color: "hsl(35, 93%, 50%)" },
      { label: "Desinteresado", value: countLabel('desinteresado'), percentage: total > 0 ? Math.round((countLabel('desinteresado') / total) * 100) : 0, color: "hsl(0, 70%, 60%)" },
      { label: "Venta Exitosa", value: countLabel('venta_exitosa'), percentage: total > 0 ? Math.round((countLabel('venta_exitosa') / total) * 100) : 0, color: "hsl(160, 84%, 39%)" },
    ];
  })();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const periodLabel = selectedMonth
    ? selectedMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })
    : "Año 2026";

  const trendPeriodLabel = selectedMonth
    ? selectedMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })
    : new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' }) + ' (Mes Actual)';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={refetch} title="Actualizar datos">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Select
            value={selectedMonth ? selectedMonth.getMonth().toString() : ALL_TIME_VALUE}
            onValueChange={(value) => {
              if (value === ALL_TIME_VALUE) {
                setSelectedMonth(null);
              } else {
                const newDate = new Date();
                newDate.setMonth(parseInt(value));
                newDate.setFullYear(2026); // Default to 2026 as requested
                setSelectedMonth(newDate);
              }
              setSelectedWeek("1"); // Reset week when month changes
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Seleccionar periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TIME_VALUE}>Todo el año</SelectItem>
              {[
                { value: "0", label: "Enero" },
                { value: "1", label: "Febrero" },
                { value: "2", label: "Marzo" },
                { value: "3", label: "Abril" },
                { value: "4", label: "Mayo" },
                { value: "5", label: "Junio" },
                { value: "6", label: "Julio" },
                { value: "7", label: "Agosto" },
                { value: "8", label: "Septiembre" },
                { value: "9", label: "Octubre" },
                { value: "10", label: "Noviembre" },
                { value: "11", label: "Diciembre" },
              ].map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 mb-8">
        <KPICard
          title="Total de Leads Entrantes"
          value={kpis.totalLeads.toLocaleString()}
          subtitle={periodLabel}
          icon={Users}
          variant="primary"
          size="lg"
        />
        <KPICard
          title="Leads Interesados"
          value={kpis.leadsInteresados.toLocaleString()}
          subtitle={periodLabel}
          icon={Target}
          size="lg"
        />
        <KPICard
          title="Citas Agendadas"
          value={kpis.citasAgendadas.toLocaleString()}
          subtitle={periodLabel}
          icon={Calendar}
          size="lg"
        />
        <KPICard
          title="No Califican"
          value={kpis.noCalifican.toLocaleString()}
          subtitle={periodLabel}
          icon={AlertTriangle}
          variant="warning"
          size="lg"
        />
        <KPICard
          title="Tasa de Agendamiento"
          value={`${kpis.tasaAgendamiento}%`}
          subtitle={periodLabel}
          icon={TrendingUp}
          variant="accent"
          size="lg"
        />
        <KPICard
          title="Ganancia Mensual"
          value={formatCurrency(kpis.gananciaMensual)}
          subtitle={periodLabel}
          icon={DollarSign}
          variant="success"
          size="lg"
        />
        <KPICard
          title="Ganancia Total"
          value={formatCurrency(kpis.gananciaTotal)}
          subtitle="Todo el Período"
          icon={DollarSign}
          variant="accent"
          size="lg"
        />
      </div>

      {/* Funnel & Mini KPIs */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <SectionCard
          title="Funnel Principal"
          subtitle={`Conversión - ${periodLabel}${selectedChannel !== 'all' ? ` · ${selectedChannel}` : ''}`}
          icon={Filter}
          className="xl:col-span-2"
          action={
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los canales</SelectItem>
                {availableChannels.map((ch: string) => (
                  <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        >
          <FunnelChart stages={filteredFunnelData} />
        </SectionCard>

        <div className="space-y-4">
          <KPICard
            title="Tasa de Respuesta"
            value={`${kpis.tasaRespuesta}%`}
            subtitle={periodLabel}
            icon={MessageSquare}
            variant="success"
          />
          <KPICard
            title="Tasa de Interés"
            value={`${kpis.totalLeads > 0 ? Math.round((kpis.leadsInteresados / kpis.totalLeads) * 100) : 0}%`}
            subtitle={periodLabel}
            icon={CheckCircle}
          />
          <KPICard
            title="Tasa de Agendamiento"
            value={`${kpis.tasaAgendamiento}%`}
            subtitle={periodLabel}
            icon={Calendar}
          />
          <KPICard
            title="Tasa de Descarte"
            value={`${kpis.tasaDescarte}%`}
            subtitle={periodLabel}
            icon={AlertTriangle}
            variant="warning"
          />
        </div>
      </div>

      {/* Channel Breakdown & Weekly Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SectionCard
          title="Desglose por Canal"
          subtitle={`Rendimiento - ${periodLabel}`}
          icon={MessageSquare}
        >
          <ChannelBreakdown data={channelData} />
        </SectionCard>

        <SectionCard
          title="Tendencia Semanal"
          subtitle={`Semana ${selectedWeek} - ${trendPeriodLabel}`}
          icon={TrendingUp}
          action={
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="Semana" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Semana 1</SelectItem>
                <SelectItem value="2">Semana 2</SelectItem>
                <SelectItem value="3">Semana 3</SelectItem>
                <SelectItem value="4">Semana 4</SelectItem>
                <SelectItem value="5">Semana 5</SelectItem>
              </SelectContent>
            </Select>
          }
        >
          <WeeklyTrend data={weeklyTrend} />
          <div className="mt-4 flex items-center justify-center gap-4 flex-wrap">
            {[
              { color: "bg-[hsl(224,62%,32%)]", label: "Leads (Total)" },
              { color: "bg-[hsl(260,60%,50%)]", label: "Interesado" },
              { color: "bg-[hsl(142,60%,45%)]", label: "Crear Confianza" },
              { color: "bg-[hsl(142,60%,55%)]", label: "Crear Urgencia" },
              { color: "bg-[hsl(45,93%,48%)]", label: "Cita Agendada" },
              { color: "bg-[hsl(35,93%,50%)]", label: "Cita Agendada Jess" },
              { color: "bg-[hsl(0,70%,60%)]", label: "Desinteresado" },
              { color: "bg-[hsl(160,84%,39%)]", label: "Venta Exitosa" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Recent Appointments Table */}
      <SectionCard
        title="Últimas Citas Agendadas"
        subtitle={`Datos capturados - ${periodLabel}`}
        icon={Calendar}
        className="mb-8"
      >
        <RecentAppointments appointments={recentAppointments} />
      </SectionCard>


      {/* Data Capture */}
      <SectionCard
        title="Captura de Datos"
        subtitle={`Eficiencia - ${periodLabel}`}
        icon={Database}
        className="mb-8"
      >
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <KPICard title="Tasa de Completitud" value={`${dataCapture.completionRate}%`} variant="success" size="sm" />
          <KPICard title="Conversaciones Incompletas" value={dataCapture.incomplete.toString()} size="sm" />
          <KPICard title="Tiempo Promedio Captura" value="2.8 min" size="sm" />
        </div>
        <DataCaptureChart data={dataCapture} />
      </SectionCard>

      {/* Operational Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <SectionCard
          title="Tiempo de Respuesta"
          subtitle={`Promedio - ${periodLabel}`}
          icon={Clock}
          className="flex flex-col items-center"
        >
          <ResponseTimeGauge value={responseTime} />
        </SectionCard>


      </div>

      {/* Monthly Trend */}
      <SectionCard
        title="Tendencia Mensual Completa"
        subtitle={`Evolución - ${trendPeriodLabel}`}
        icon={BarChart3}
      >
        <TrendChart data={monthlyTrend} />
        <div className="mt-4 flex items-center justify-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Leads</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-accent" />
            <span className="text-sm text-muted-foreground">Interesados</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-sm text-muted-foreground">Citas</span>
          </div>
        </div>
      </SectionCard>

      {/* Footer */}
      <footer className="mt-8 pt-6 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          Dashboard de Desempeño – Agente Funnel Implanta · Powered by{" "}
          <span className="font-semibold text-primary">Simplia IA</span>
        </p>
      </footer>
    </div>
  );
};

export default Index;
