
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Expenses = () => {
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const expenses = [
    {
      id: 1,
      description: 'Manutenzione caldaia',
      amount: 350,
      category: 'Manutenzione',
      property: 'Via Roma 123',
      date: '2024-01-15',
      status: 'Pagato'
    },
    {
      id: 2,
      description: 'Assicurazione annuale',
      amount: 1200,
      category: 'Assicurazione',
      property: 'Corso Milano 45',
      date: '2024-01-10',
      status: 'Pagato'
    },
    {
      id: 3,
      description: 'Pulizie comuni',
      amount: 150,
      category: 'Pulizie',
      property: 'Via Verdi 78',
      date: '2024-01-08',
      status: 'In sospeso'
    }
  ];

  const monthlyData = [
    { month: 'Gen', amount: 2100 },
    { month: 'Feb', amount: 2300 },
    { month: 'Mar', amount: 1900 },
    { month: 'Apr', amount: 2500 },
    { month: 'Mag', amount: 2200 },
    { month: 'Giu', amount: 2350 },
  ];

  const categories = ['Manutenzione', 'Assicurazione', 'Pulizie', 'Utenze', 'Tasse', 'Altro'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pagato': return 'bg-green-100 text-green-800';
      case 'In sospeso': return 'bg-yellow-100 text-yellow-800';
      case 'Scaduto': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const pendingExpenses = expenses.filter(e => e.status === 'In sospeso').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Spese</h1>
        <Button className="bg-blue-600 hover:bg-blue-700">
          Aggiungi Spesa
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Spese Totali</p>
                <p className="text-2xl font-bold">€{totalExpenses.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-orange-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">In Sospeso</p>
                <p className="text-2xl font-bold">{pendingExpenses}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Media Mensile</p>
                <p className="text-2xl font-bold">€{Math.round(totalExpenses / 6).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Andamento Spese Mensili</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => [`€${value}`, 'Spese']} />
              <Line type="monotone" dataKey="amount" stroke="#3B82F6" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Elenco Spese</CardTitle>
          <div className="flex gap-4">
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtra per proprietà" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le proprietà</SelectItem>
                <SelectItem value="via-roma-123">Via Roma 123</SelectItem>
                <SelectItem value="corso-milano-45">Corso Milano 45</SelectItem>
                <SelectItem value="via-verdi-78">Via Verdi 78</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtra per categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le categorie</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category.toLowerCase()}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {expenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{expense.description}</h3>
                    <Badge variant="outline">{expense.category}</Badge>
                    <Badge className={getStatusColor(expense.status)}>
                      {expense.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{expense.property}</p>
                  <p className="text-sm text-gray-500">{new Date(expense.date).toLocaleDateString('it-IT')}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">€{expense.amount}</p>
                  <Button variant="ghost" size="sm" className="mt-1">
                    Dettagli
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Expenses;
