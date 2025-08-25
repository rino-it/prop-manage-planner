
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { House, TrendingUp, Calendar, AlertTriangle, Euro, Target, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { usePropertiesReal, usePropertiesMobile } from '@/hooks/useProperties';
import { usePaymentStats, useUpcomingPayments } from '@/hooks/usePayments';
import { useActivityStats, useUpcomingActivities } from '@/hooks/useActivities';
import { useIncomeStats, usePropertyPerformance } from '@/hooks/useIncome';
import { useUpcomingNotifications } from '@/hooks/useNotifications';

const Dashboard = () => {
  const { data: propertiesReal = [] } = usePropertiesReal();
  const { data: propertiesMobile = [] } = usePropertiesMobile();
  const { data: paymentStats } = usePaymentStats();
  const { data: activityStats } = useActivityStats();
  const { data: upcomingPayments = [] } = useUpcomingPayments();
  const { data: upcomingActivities = [] } = useUpcomingActivities();
  const { data: incomeStats } = useIncomeStats();
  const { data: propertyPerformance = [] } = usePropertyPerformance();
  const { data: upcomingNotifications = [] } = useUpcomingNotifications();
  
  const totalProperties = propertiesReal.length + propertiesMobile.length;
  const yearlyExpenses = paymentStats?.totalAmount || 0;
  const yearlyIncome = incomeStats?.totalIncome || 0;
  const netIncome = yearlyIncome - yearlyExpenses;
  const scheduledActivities = activityStats?.pendingActivities || 0;
  const urgentNotifications = upcomingNotifications.filter(n => n.priorita === 'alta' || n.priorita === 'critica').length;
  
  // Calculate average ROI across all properties
  const avgROI = propertyPerformance.length > 0 
    ? propertyPerformance.reduce((sum, prop) => sum + (Number(prop.roi_percentuale) || 0), 0) / propertyPerformance.length 
    : 0;
  
  const stats = [
    { title: 'Proprietà Totali', value: totalProperties.toString(), icon: House, color: 'hsl(var(--primary))' },
    { title: 'Entrate Annuali', value: `€${yearlyIncome.toLocaleString()}`, icon: Euro, color: 'hsl(142, 71%, 45%)' },
    { title: 'Spese Annuali', value: `€${yearlyExpenses.toLocaleString()}`, icon: TrendingUp, color: 'hsl(var(--destructive))' },
    { title: 'Reddito Netto', value: `€${netIncome.toLocaleString()}`, icon: Target, color: netIncome >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(var(--destructive))' },
    { title: 'ROI Medio', value: `${avgROI.toFixed(1)}%`, icon: Activity, color: 'hsl(262, 83%, 58%)' },
    { title: 'Alert Urgenti', value: urgentNotifications.toString(), icon: AlertTriangle, color: urgentNotifications > 0 ? 'hsl(var(--destructive))' : 'hsl(142, 71%, 45%)' },
  ];

  // Generate monthly financial data for the last 6 months
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    const monthName = date.toLocaleDateString('it-IT', { month: 'short' });
    
    // TODO: Calculate real income/expenses per month from database
    const income = Math.floor(Math.random() * 2000) + 3000;
    const expenses = Math.floor(Math.random() * 1000) + 1500;
    const net = income - expenses;
    
    return { 
      month: monthName, 
      entrate: income,
      spese: expenses,
      netto: net
    };
  });

  const realPropertyTypes = propertiesReal.reduce((acc, prop) => {
    const type = prop.tipo === 'appartamento' ? 'Appartamenti' :
                 prop.tipo === 'casa' ? 'Case' :
                 prop.tipo === 'ufficio' ? 'Uffici' : 'Altro';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mobilePropertyTypes = propertiesMobile.reduce((acc, prop) => {
    const type = prop.categoria === 'veicolo' ? 'Veicoli' :
                 prop.categoria === 'imbarcazione' ? 'Imbarcazioni' : 'Attrezzature';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const propertyTypes = [
    ...Object.entries(realPropertyTypes).map(([name, value], index) => ({
      name: name.length > 10 ? name.substring(0, 8) + '...' : name,
      fullName: name,
      value,
      color: ['hsl(221, 83%, 53%)', 'hsl(142, 71%, 45%)', 'hsl(262, 83%, 58%)', 'hsl(36, 84%, 55%)'][index % 4]
    })),
    ...Object.entries(mobilePropertyTypes).map(([name, value], index) => ({
      name: name.length > 10 ? name.substring(0, 8) + '...' : name,
      fullName: name,
      value,
      color: ['hsl(0, 72%, 51%)', 'hsl(25, 95%, 53%)', 'hsl(84, 81%, 44%)'][index % 3]
    }))
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="text-sm text-gray-500">
          Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="hover:shadow-md transition-all duration-200 border-l-4" style={{ borderLeftColor: stat.color }}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground mt-1" style={{ color: stat.color }}>{stat.value}</p>
                  </div>
                  <div className="p-3 rounded-full bg-secondary/20">
                    <Icon className="w-6 h-6" style={{ color: stat.color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Andamento Finanziario Mensile</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    `€${Number(value).toLocaleString()}`, 
                    name === 'entrate' ? 'Entrate' : name === 'spese' ? 'Spese' : 'Netto'
                  ]} 
                />
                <Line 
                  type="monotone" 
                  dataKey="entrate" 
                  stroke="hsl(142, 71%, 45%)" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(142, 71%, 45%)', strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="spese" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--destructive))', strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="netto" 
                  stroke="hsl(262, 83%, 58%)" 
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ fill: 'hsl(262, 83%, 58%)', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuzione Proprietà</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={propertyTypes}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {propertyTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name, props) => [
                    `${value} proprietà`, 
                    props.payload?.fullName || name
                  ]} 
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Performance Proprietà
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {propertyPerformance.length > 0 ? propertyPerformance.slice(0, 3).map((property) => (
                <div key={property.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div>
                    <p className="font-medium">{property.codice_identificativo || property.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {property.stato === 'affitto' ? '🏠 In Affitto' : 
                       property.stato === 'uso_personale' ? '🏡 Uso Personale' : '🔧 Ristrutturazione'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${
                      Number(property.roi_percentuale) >= 5 ? 'text-green-600' :
                      Number(property.roi_percentuale) >= 0 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      ROI {Number(property.roi_percentuale).toFixed(1)}%
                    </span>
                    <p className="text-xs text-muted-foreground">
                      €{Number(property.reddito_netto_annuale).toLocaleString()}/anno
                    </p>
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground text-center py-4">Nessun dato performance disponibile</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Prossime Attività
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingActivities.length > 0 ? upcomingActivities.slice(0, 3).map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div>
                    <p className="font-medium">{activity.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {activity.properties_real?.nome || activity.properties_mobile?.nome || 'Proprietà generale'}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(activity.prossima_scadenza).toLocaleDateString('it-IT')}
                  </span>
                </div>
              )) : (
                <p className="text-muted-foreground text-center py-4">Nessuna attività programmata</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Alert & Notifiche
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingNotifications.length > 0 ? upcomingNotifications.slice(0, 3).map((notification) => (
                <div key={notification.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{notification.titolo}</p>
                    <p className="text-xs text-muted-foreground">
                      {notification.properties_real?.codice_identificativo || notification.properties_mobile?.codice_identificativo || 'Generale'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      notification.priorita === 'critica' ? 'bg-red-100 text-red-700' :
                      notification.priorita === 'alta' ? 'bg-orange-100 text-orange-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {Math.ceil((new Date(notification.data_scadenza).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} giorni
                    </span>
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground text-center py-4">Nessun alert urgente</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
