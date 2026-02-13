
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Progress } from '@/components/ui/progress';
import { DataTable } from '@/components/ui/data-table';
import { MapPin, Settings, Calendar, AlertTriangle } from 'lucide-react';

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

  const getConditionVariant = (condition: string) => {
    switch (condition) {
      case 'Ottima': return 'success';
      case 'Buona': return 'info';
      case 'Discreta': return 'warning';
      case 'Scarsa': return 'danger';
      default: return 'secondary';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-success';
    if (score >= 75) return 'text-info';
    if (score >= 60) return 'text-warning';
    return 'text-danger';
  };

  const avgScore = Math.round(conditions.reduce((sum, prop) => sum + prop.overallScore, 0) / conditions.length);
  const needsAttention = conditions.filter(prop => prop.overallScore < 75).length;
  const criticalIssues = conditions.reduce((count, prop) => 
    count + prop.components.filter(comp => comp.score < 60).length, 0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Monitoraggio Condizioni</h1>
        <Button>
          Nuova Ispezione
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Settings className="w-6 h-6 text-info mr-2" />
              <div>
                <p className="text-sm text-muted-foreground">Punteggio Medio</p>
                <p className={`text-xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}/100</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertTriangle className="w-6 h-6 text-warning mr-2" />
              <div>
                <p className="text-sm text-muted-foreground">Richiedono Attenzione</p>
                <p className="text-xl font-bold text-warning">{needsAttention}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Settings className="w-6 h-6 text-danger mr-2" />
              <div>
                <p className="text-sm text-muted-foreground">Problemi Critici</p>
                <p className="text-xl font-bold text-danger">{criticalIssues}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Calendar className="w-6 h-6 text-success mr-2" />
              <div>
                <p className="text-sm text-muted-foreground">Ispez. Recenti</p>
                <p className="text-xl font-bold text-success">2</p>
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
                    <p className="text-sm text-muted-foreground">Punteggio Generale</p>
                    <p className={`text-2xl font-bold ${getScoreColor(property.overallScore)}`}>
                      {property.overallScore}/100
                    </p>
                  </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Ultima Ispezione</p>
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
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold">{component.name}</h4>
                        <StatusBadge variant={getConditionVariant(component.condition) as any}>
                          {component.condition}
                        </StatusBadge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Ultimo controllo: {new Date(component.lastCheck).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-muted-foreground">Punteggio</span>
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
