
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MapPin, Settings, Calendar } from 'lucide-react';

const Conditions = () => {
  const [selectedProperty, setSelectedProperty] = useState('all');

  const conditions = [
    {
      id: 1,
      property: 'Via Roma 123',
      overallScore: 85,
      lastInspection: '2024-01-10',
      components: [
        { name: 'Impianto elettrico', condition: 'Buona', score: 90, lastCheck: '2024-01-10' },
        { name: 'Impianto idraulico', condition: 'Ottima', score: 95, lastCheck: '2024-01-05' },
        { name: 'Riscaldamento', condition: 'Buona', score: 85, lastCheck: '2024-01-08' },
        { name: 'Struttura', condition: 'Discreta', score: 70, lastCheck: '2023-12-15' },
        { name: 'Infissi', condition: 'Buona', score: 80, lastCheck: '2024-01-12' }
      ]
    },
    {
      id: 2,
      property: 'Corso Milano 45',
      overallScore: 92,
      lastInspection: '2024-01-08',
      components: [
        { name: 'Impianto elettrico', condition: 'Ottima', score: 95, lastCheck: '2024-01-08' },
        { name: 'Impianto idraulico', condition: 'Ottima', score: 90, lastCheck: '2024-01-08' },
        { name: 'Climatizzazione', condition: 'Ottima', score: 95, lastCheck: '2024-01-08' },
        { name: 'Struttura', condition: 'Ottima', score: 90, lastCheck: '2024-01-08' },
        { name: 'Sicurezza', condition: 'Ottima', score: 90, lastCheck: '2024-01-08' }
      ]
    },
    {
      id: 3,
      property: 'Via Verdi 78',
      overallScore: 68,
      lastInspection: '2023-12-20',
      components: [
        { name: 'Impianto elettrico', condition: 'Discreta', score: 65, lastCheck: '2023-12-20' },
        { name: 'Impianto idraulico', condition: 'Scarsa', score: 45, lastCheck: '2023-12-20' },
        { name: 'Riscaldamento', condition: 'Buona', score: 80, lastCheck: '2023-12-20' },
        { name: 'Struttura', condition: 'Discreta', score: 70, lastCheck: '2023-12-20' },
        { name: 'Copertura', condition: 'Scarsa', score: 50, lastCheck: '2023-12-20' }
      ]
    }
  ];

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'Ottima': return 'bg-green-100 text-green-800';
      case 'Buona': return 'bg-blue-100 text-blue-800';
      case 'Discreta': return 'bg-yellow-100 text-yellow-800';
      case 'Scarsa': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 75) return 'bg-blue-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const avgScore = Math.round(conditions.reduce((sum, prop) => sum + prop.overallScore, 0) / conditions.length);
  const needsAttention = conditions.filter(prop => prop.overallScore < 75).length;
  const criticalIssues = conditions.reduce((count, prop) => 
    count + prop.components.filter(comp => comp.score < 60).length, 0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Monitoraggio Condizioni</h1>
        <Button className="bg-blue-600 hover:bg-blue-700">
          Nuova Ispezione
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Settings className="w-6 h-6 text-blue-500 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Punteggio Medio</p>
                <p className={`text-xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}/100</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <MapPin className="w-6 h-6 text-orange-500 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Richiedono Attenzione</p>
                <p className="text-xl font-bold text-orange-600">{needsAttention}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Settings className="w-6 h-6 text-red-500 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Problemi Critici</p>
                <p className="text-xl font-bold text-red-600">{criticalIssues}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Calendar className="w-6 h-6 text-green-500 mr-2" />
              <div>
                <p className="text-sm text-gray-600">Ispez. Recenti</p>
                <p className="text-xl font-bold text-green-600">2</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {conditions.map((property) => (
          <Card key={property.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <MapPin className="w-5 h-5" />
                  {property.property}
                </CardTitle>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Punteggio Generale</p>
                    <p className={`text-2xl font-bold ${getScoreColor(property.overallScore)}`}>
                      {property.overallScore}/100
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Ultima Ispezione</p>
                    <p className="font-semibold">
                      {new Date(property.lastInspection).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {property.components.map((component, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold">{component.name}</h4>
                        <Badge className={getConditionColor(component.condition)}>
                          {component.condition}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        Ultimo controllo: {new Date(component.lastCheck).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600">Punteggio</span>
                          <span className={`font-semibold ${getScoreColor(component.score)}`}>
                            {component.score}/100
                          </span>
                        </div>
                        <Progress 
                          value={component.score} 
                          className="h-2"
                        />
                      </div>
                      <Button variant="outline" size="sm">
                        Dettagli
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2 mt-4 border-t pt-4">
                <Button variant="outline">
                  Programma Ispezione
                </Button>
                <Button variant="outline">
                  Storico Condizioni
                </Button>
                <Button>
                  Genera Report
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Conditions;
