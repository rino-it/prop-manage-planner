
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { House, TrendingUp, Calendar, MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Dashboard = () => {
  const stats = [
    { title: 'Proprietà Totali', value: '12', icon: House, color: 'bg-blue-500' },
    { title: 'Spese Mensili', value: '€2,350', icon: TrendingUp, color: 'bg-green-500' },
    { title: 'Attività Programmate', value: '8', icon: Calendar, color: 'bg-purple-500' },
    { title: 'Manutenzioni Urgenti', value: '3', icon: MapPin, color: 'bg-red-500' },
  ];

  const expenseData = [
    { month: 'Gen', amount: 2100 },
    { month: 'Feb', amount: 2300 },
    { month: 'Mar', amount: 1900 },
    { month: 'Apr', amount: 2500 },
    { month: 'Mag', amount: 2200 },
    { month: 'Giu', amount: 2350 },
  ];

  const propertyTypes = [
    { name: 'Residenziali', value: 8, color: '#3B82F6' },
    { name: 'Commerciali', value: 3, color: '#10B981' },
    { name: 'Industriali', value: 1, color: '#8B5CF6' },
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
              <BarChart data={expenseData}>
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
              {[
                { action: 'Manutenzione caldaia', property: 'Via Roma 123', date: '2 ore fa' },
                { action: 'Pagamento affitto', property: 'Corso Milano 45', date: '1 giorno fa' },
                { action: 'Ispezione impianto', property: 'Via Verdi 78', date: '3 giorni fa' },
              ].map((activity, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div>
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-sm text-gray-600">{activity.property}</p>
                  </div>
                  <span className="text-sm text-gray-500">{activity.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prossime Scadenze</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { task: 'Controllo antincendio', property: 'Ufficio Centro', date: 'Domani' },
                { task: 'Rinnovo assicurazione', property: 'Appartamento A1', date: '5 giorni' },
                { task: 'Ispezione ascensore', property: 'Condominio B', date: '1 settimana' },
              ].map((task, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div>
                    <p className="font-medium">{task.task}</p>
                    <p className="text-sm text-gray-600">{task.property}</p>
                  </div>
                  <span className="text-sm text-orange-600 font-medium">{task.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
