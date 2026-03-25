import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { KpiCard } from '@/components/ui/kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useStatistics, type PeriodFilter } from '@/hooks/useStatistics';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, Percent, BedDouble, Banknote,
  CalendarClock, Building2, BarChart3, Loader2
} from 'lucide-react';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function trendInfo(current: number, diff: number): { value: string; direction: 'up' | 'down' | 'neutral' } {
  if (diff === 0) return { value: 'Invariato', direction: 'neutral' };
  const sign = diff > 0 ? '+' : '';
  return {
    value: `${sign}${diff}% vs periodo prec.`,
    direction: diff > 0 ? 'up' : 'down',
  };
}

export default function Statistics() {
  const [period, setPeriod] = useState<PeriodFilter>('trimestre');
  const [propertyId, setPropertyId] = useState<string | null>(null);

  const {
    isLoading,
    properties,
    occupancyRate,
    occupancyTrend,
    adr,
    adrTrend,
    revpar,
    revparTrend,
    totalRevenue,
    totalExpenses,
    netIncome,
    totalBookings,
    prevBookingsCount,
    avgLeadTime,
    monthlyData,
    propertyPerformance,
  } = useStatistics({ period, propertyId });

  const bookingsTrendPct = prevBookingsCount > 0
    ? Math.round(((totalBookings - prevBookingsCount) / prevBookingsCount) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const revenueExpenseChart = {
    incassi: { label: 'Incassi', color: '#10b981' },
    spese: { label: 'Spese', color: '#ef4444' },
  };

  const bookingTrendChart = {
    prenotazioni: { label: 'Prenotazioni', color: '#2563eb' },
  };

  const occupancyByProperty = propertyPerformance.map(p => ({
    nome: p.nome.length > 18 ? p.nome.substring(0, 16) + '...' : p.nome,
    occupazione: p.totalDays > 0 ? Math.round((p.occupiedDays / p.totalDays) * 100) : 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Statistiche">
        <Select value={propertyId ?? 'all'} onValueChange={(v) => setPropertyId(v === 'all' ? null : v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tutte le proprieta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Portafoglio completo</SelectItem>
            {properties.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mese">Mese</SelectItem>
            <SelectItem value="trimestre">Trimestre</SelectItem>
            <SelectItem value="anno">Anno</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Tasso di Occupazione"
          value={`${occupancyRate}%`}
          trend={trendInfo(occupancyRate, occupancyTrend)}
          icon={<Percent className="h-5 w-5" />}
          iconColor="blue"
        />
        <KpiCard
          title="ADR (Media/Notte)"
          value={formatCurrency(adr)}
          trend={trendInfo(adr, adrTrend)}
          icon={<BedDouble className="h-5 w-5" />}
          iconColor="green"
        />
        <KpiCard
          title="RevPAR"
          value={formatCurrency(revpar)}
          trend={trendInfo(revpar, revparTrend)}
          icon={<BarChart3 className="h-5 w-5" />}
          iconColor="orange"
        />
        <KpiCard
          title="Prenotazioni"
          value={totalBookings}
          trend={trendInfo(totalBookings, bookingsTrendPct)}
          icon={<CalendarClock className="h-5 w-5" />}
          iconColor="blue"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Incassi Totali"
          value={formatCurrency(totalRevenue)}
          icon={<Banknote className="h-5 w-5" />}
          iconColor="green"
        />
        <KpiCard
          title="Spese Totali"
          value={formatCurrency(totalExpenses)}
          icon={<Banknote className="h-5 w-5" />}
          iconColor="red"
        />
        <KpiCard
          title="Netto"
          value={formatCurrency(netIncome)}
          trend={{
            value: `Lead time medio: ${avgLeadTime}gg`,
            direction: 'neutral',
          }}
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor={netIncome >= 0 ? 'green' : 'red'}
        />
      </div>

      <Tabs defaultValue="finanze" className="space-y-4">
        <TabsList>
          <TabsTrigger value="finanze">Incassi vs Spese</TabsTrigger>
          <TabsTrigger value="prenotazioni">Trend Prenotazioni</TabsTrigger>
          <TabsTrigger value="occupazione">Occupazione per Proprieta</TabsTrigger>
          <TabsTrigger value="rendimento">Top Rendimento</TabsTrigger>
        </TabsList>

        <TabsContent value="finanze">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Incassi vs Spese per periodo</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length === 0 ? (
                <EmptyChart message="Nessun dato finanziario per il periodo selezionato" />
              ) : (
                <ChartContainer config={revenueExpenseChart} className="h-[350px] w-full">
                  <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" className="text-xs" />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="incassi" fill="var(--color-incassi)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="spese" fill="var(--color-spese)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prenotazioni">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trend prenotazioni mese su mese</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length === 0 ? (
                <EmptyChart message="Nessuna prenotazione per il periodo selezionato" />
              ) : (
                <ChartContainer config={bookingTrendChart} className="h-[350px] w-full">
                  <LineChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" className="text-xs" />
                    <YAxis allowDecimals={false} className="text-xs" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="prenotazioni"
                      stroke="var(--color-prenotazioni)"
                      strokeWidth={2}
                      dot={{ r: 4, fill: 'var(--color-prenotazioni)' }}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="occupazione">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tasso di occupazione per proprieta</CardTitle>
            </CardHeader>
            <CardContent>
              {occupancyByProperty.length === 0 ? (
                <EmptyChart message="Nessuna proprieta disponibile" />
              ) : (
                <ChartContainer
                  config={{ occupazione: { label: 'Occupazione %', color: '#2563eb' } }}
                  className="h-[350px] w-full"
                >
                  <BarChart data={occupancyByProperty} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} className="text-xs" />
                    <YAxis dataKey="nome" type="category" width={120} className="text-xs" />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => `${value}%`}
                    />
                    <Bar dataKey="occupazione" radius={[0, 4, 4, 0]}>
                      {occupancyByProperty.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rendimento">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Classifica proprieta per rendimento netto</CardTitle>
            </CardHeader>
            <CardContent>
              {propertyPerformance.length === 0 ? (
                <EmptyChart message="Nessun dato di rendimento disponibile" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proprieta</TableHead>
                      <TableHead className="text-right">Incassi</TableHead>
                      <TableHead className="text-right">Spese</TableHead>
                      <TableHead className="text-right">Netto</TableHead>
                      <TableHead className="text-right">Notti</TableHead>
                      <TableHead className="text-right">Occupazione</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propertyPerformance.map((p) => {
                      const occ = p.totalDays > 0 ? Math.round((p.occupiedDays / p.totalDays) * 100) : 0;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.nome}</TableCell>
                          <TableCell className="text-right text-emerald-600">{formatCurrency(p.revenue)}</TableCell>
                          <TableCell className="text-right text-red-500">{formatCurrency(p.expenses)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            <span className={p.netto >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                              {formatCurrency(p.netto)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{p.nights}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${occ}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right">{occ}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
      {message}
    </div>
  );
}
