
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { House, TrendingUp, Calendar, MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { usePropertiesReal, usePropertiesMobile } from '@/hooks/useProperties';
import { usePaymentStats, useUpcomingPayments } from '@/hooks/usePayments';
import { useActivityStats, useUpcomingActivities } from '@/hooks/useActivities';

const Dashboard = () => {
  const { data: propertiesReal = [] } = usePropertiesReal();
  const { data: propertiesMobile = [] } = usePropertiesMobile();
  const { data: paymentStats } = usePaymentStats();
  const { data: activityStats } = useActivityStats();
  const { data: upcomingPayments = [] } = useUpcomingPayments();
  const { data: upcomingActivities = [] } = useUpcomingActivities();
  
  const totalProperties = propertiesReal.length + propertiesMobile.length;
  const monthlyExpenses = paymentStats?.totalAmount || 0;
  const scheduledActivities = activityStats?.pendingActivities || 0;
  const urgentMaintenance = activityStats?.urgentActivities || 0;
  
  const stats = [
    { title: 'Proprietà Totali', value: totalProperties.toString(), icon: House, color: 'bg-blue-500' },
    { title: 'Spese Annuali', value: `€${monthlyExpenses.toLocaleString()}`, icon: TrendingUp, color: 'bg-green-500' },
    { title: 'Attività Programmate', value: scheduledActivities.toString(), icon: Calendar, color: 'bg-purple-500' },
    { title: 'Manutenzioni Urgenti', value: urgentMaintenance.toString(), icon: MapPin, color: 'bg-red-500' },
  ];

  // Calcola i dati per i grafici basandosi sui dati reali
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    const monthName = date.toLocaleDateString('it-IT', { month: 'short' });
    
    // Calcola le spese per questo mese (simulato per ora)
    const amount = Math.floor(Math.random() * 1000) + 1500;
    return { month: monthName, amount };
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
      name,
      value,
      color: ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B'][index % 4]
    })),
    ...Object.entries(mobilePropertyTypes).map(([name, value], index) => ({
      name,
      value,
      color: ['#EF4444', '#F97316', '#84CC16'][index % 3]
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.color}`}>
                    <Icon className="w-6 h-6 text-white" />
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
            <CardTitle>Andamento Spese Mensili</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`€${value}`, 'Spese']} />
                <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
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
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {propertyTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Attività Recenti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingActivities.length > 0 ? upcomingActivities.slice(0, 3).map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div>
                    <p className="font-medium">{activity.nome}</p>
                    <p className="text-sm text-gray-600">
                      {activity.properties_real?.nome || activity.properties_mobile?.nome || 'Proprietà generale'}
                    </p>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(activity.prossima_scadenza).toLocaleDateString('it-IT')}
                  </span>
                </div>
              )) : (
                <p className="text-gray-500 text-center py-4">Nessuna attività recente</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prossime Scadenze</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingPayments.length > 0 ? upcomingPayments.slice(0, 3).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div>
                    <p className="font-medium">{payment.descrizione}</p>
                    <p className="text-sm text-gray-600">
                      {payment.properties_real?.nome || payment.properties_mobile?.nome || 'Generale'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-orange-600 font-medium">
                      {Math.ceil((new Date(payment.scadenza).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} giorni
                    </span>
                    <p className="text-xs text-gray-500">€{Number(payment.importo).toLocaleString()}</p>
                  </div>
                </div>
              )) : (
                <p className="text-gray-500 text-center py-4">Nessuna scadenza imminente</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
