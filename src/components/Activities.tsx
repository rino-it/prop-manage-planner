
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin } from 'lucide-react';

const Activities = () => {
  const [selectedFilter, setSelectedFilter] = useState('all');

  const activities = [
    {
      id: 1,
      title: 'Ispezione impianto elettrico',
      property: 'Via Roma 123',
      date: '2024-01-20',
      time: '10:00',
      type: 'Manutenzione',
      priority: 'Alta',
      status: 'Programmata',
      description: 'Controllo annuale dell\'impianto elettrico'
    },
    {
      id: 2,
      title: 'Pulizia condominiale',
      property: 'Corso Milano 45',
      date: '2024-01-18',
      time: '08:00',
      type: 'Pulizie',
      priority: 'Media',
      status: 'In corso',
      description: 'Pulizia settimanale delle parti comuni'
    },
    {
      id: 3,
      title: 'Rinnovo contratto',
      property: 'Via Verdi 78',
      date: '2024-01-25',
      time: '14:30',
      type: 'Amministrativa',
      priority: 'Alta',
      status: 'Programmata',
      description: 'Incontro per rinnovo contratto di locazione'
    },
    {
      id: 4,
      title: 'Controllo caldaia',
      property: 'Via Roma 123',
      date: '2024-01-15',
      time: '09:00',
      type: 'Manutenzione',
      priority: 'Media',
      status: 'Completata',
      description: 'Controllo e manutenzione ordinaria caldaia'
    }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Alta': return 'bg-red-100 text-red-800';
      case 'Media': return 'bg-yellow-100 text-yellow-800';
      case 'Bassa': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completata': return 'bg-green-100 text-green-800';
      case 'In corso': return 'bg-blue-100 text-blue-800';
      case 'Programmata': return 'bg-orange-100 text-orange-800';
      case 'Scaduta': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Manutenzione': return 'bg-blue-100 text-blue-800';
      case 'Pulizie': return 'bg-green-100 text-green-800';
      case 'Amministrativa': return 'bg-purple-100 text-purple-800';
      case 'Ispezione': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const upcomingActivities = activities.filter(a => a.status === 'Programmata').length;
  const completedToday = activities.filter(a => 
    a.status === 'Completata' && 
    new Date(a.date).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Attività</h1>
        <Button className="bg-blue-600 hover:bg-blue-700">
          Nuova Attività
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Calendar className="w-6 h-6 text-blue-500 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Programmate</p>
                <p className="text-xl font-bold">{upcomingActivities}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="w-6 h-6 text-green-500 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Completate oggi</p>
                <p className="text-xl font-bold">{completedToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <MapPin className="w-6 h-6 text-orange-500 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Proprietà coinvolte</p>
                <p className="text-xl font-bold">3</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Calendar className="w-6 h-6 text-red-500 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Priorità alta</p>
                <p className="text-xl font-bold">2</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calendario Attività</CardTitle>
          <div className="flex gap-2">
            {['all', 'Programmata', 'In corso', 'Completata'].map(filter => (
              <Button
                key={filter}
                variant={selectedFilter === filter ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter(filter)}
              >
                {filter === 'all' ? 'Tutte' : filter}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activities
              .filter(activity => selectedFilter === 'all' || activity.status === selectedFilter)
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((activity) => (
                <div key={activity.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{activity.title}</h3>
                        <Badge className={getStatusColor(activity.status)}>
                          {activity.status}
                        </Badge>
                        <Badge className={getPriorityColor(activity.priority)}>
                          {activity.priority}
                        </Badge>
                        <Badge className={getTypeColor(activity.type)}>
                          {activity.type}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {activity.property}
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(activity.date).toLocaleDateString('it-IT')}
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {activity.time}
                        </div>
                      </div>
                      
                      <p className="text-gray-700">{activity.description}</p>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <Button variant="outline" size="sm">
                        Modifica
                      </Button>
                      {activity.status === 'Programmata' && (
                        <Button size="sm">
                          Segna come completata
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Activities;
