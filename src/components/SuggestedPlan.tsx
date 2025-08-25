
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Calendar, TrendingUp, MapPin, Clock, AlertTriangle } from 'lucide-react';

const SuggestedPlan = () => {
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [selectedGoal, setSelectedGoal] = useState('maintenance');

  const goals = [
    { id: 'maintenance', label: 'Mantenimento Valore', icon: Settings },
    { id: 'improvement', label: 'Miglioramento', icon: TrendingUp },
    { id: 'cost-reduction', label: 'Riduzione Costi', icon: Calendar },
    { id: 'safety', label: 'Sicurezza', icon: MapPin }
  ];

  const suggestions = {
    maintenance: [
      {
        id: 1,
        title: 'Ispezione annuale impianto elettrico',
        property: 'Via Roma 123',
        priority: 'Alta',
        timeframe: '1 settimana',
        estimatedCost: 150,
        description: 'Controllo obbligatorio per sicurezza e conformità',
        category: 'Manutenzione Ordinaria',
        impact: 'Previene guasti e garantisce sicurezza'
      },
      {
        id: 2,
        title: 'Sostituzione filtri climatizzazione',
        property: 'Corso Milano 45',
        priority: 'Media',
        timeframe: '2 settimane',
        estimatedCost: 80,
        description: 'Miglioramento efficienza energetica',
        category: 'Manutenzione Ordinaria',
        impact: 'Riduce consumi del 15%'
      },
      {
        id: 3,
        title: 'Riparazione perdita idraulica',
        property: 'Via Verdi 78',
        priority: 'Urgente',
        timeframe: '3 giorni',
        estimatedCost: 300,
        description: 'Riparazione urgente per evitare danni maggiori',
        category: 'Manutenzione Straordinaria',
        impact: 'Previene danni strutturali'
      }
    ],
    improvement: [
      {
        id: 4,
        title: 'Installazione sistema domotico',
        property: 'Via Roma 123',
        priority: 'Media',
        timeframe: '1 mese',
        estimatedCost: 2500,
        description: 'Modernizzazione per aumentare valore immobiliare',
        category: 'Miglioramento',
        impact: 'Aumento valore del 8-12%'
      },
      {
        id: 5,
        title: 'Ristrutturazione bagno',
        property: 'Corso Milano 45',
        priority: 'Bassa',
        timeframe: '2 mesi',
        estimatedCost: 8000,
        description: 'Aggiornamento estetico e funzionale',
        category: 'Ristrutturazione',
        impact: 'Aumento attrattività per inquilini'
      }
    ],
    'cost-reduction': [
      {
        id: 6,
        title: 'Installazione LED in tutte le aree comuni',
        property: 'Tutti',
        priority: 'Media',
        timeframe: '2 settimane',
        estimatedCost: 500,
        description: 'Riduzione costi energetici a lungo termine',
        category: 'Efficienza Energetica',
        impact: 'Risparmio €200/anno'
      },
      {
        id: 7,
        title: 'Ottimizzazione contratti fornitori',
        property: 'Tutti',
        priority: 'Alta',
        timeframe: '1 mese',
        estimatedCost: 0,
        description: 'Rinegoziazione contratti per servizi',
        category: 'Amministrativa',
        impact: 'Risparmio 10-15% sui costi fissi'
      }
    ],
    safety: [
      {
        id: 8,
        title: 'Installazione rilevatori fumo',
        property: 'Via Verdi 78',
        priority: 'Alta',
        timeframe: '1 settimana',
        estimatedCost: 200,
        description: 'Miglioramento sicurezza antincendio',
        category: 'Sicurezza',
        impact: 'Conformità normative e sicurezza'
      },
      {
        id: 9,
        title: 'Controllo sistema allarme',
        property: 'Corso Milano 45',
        priority: 'Media',
        timeframe: '1 settimana',
        estimatedCost: 100,
        description: 'Verifica funzionamento sistema sicurezza',
        category: 'Sicurezza',
        impact: 'Prevenzione furti e danni'
      }
    ]
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'Urgente': return 'danger';
      case 'Alta': return 'warning';
      case 'Media': return 'info';
      case 'Bassa': return 'success';
      default: return 'secondary';
    }
  };

  const currentSuggestions = suggestions[selectedGoal as keyof typeof suggestions] || [];
  const totalEstimatedCost = currentSuggestions.reduce((sum, item) => sum + item.estimatedCost, 0);
  const urgentTasks = currentSuggestions.filter(item => item.priority === 'Urgente').length;
  const highPriorityTasks = currentSuggestions.filter(item => item.priority === 'Alta').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Piano Attività Suggerite</h1>
        <Button>
          Genera Report Completo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <TrendingUp className="w-6 h-6 text-info mr-2" />
              <div>
                <p className="text-sm text-muted-foreground">Costo Stimato</p>
                <p className="text-xl font-bold">€{totalEstimatedCost.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertTriangle className="w-6 h-6 text-danger mr-2" />
              <div>
                <p className="text-sm text-muted-foreground">Urgenti</p>
                <p className="text-xl font-bold text-danger">{urgentTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Calendar className="w-6 h-6 text-warning mr-2" />
              <div>
                <p className="text-sm text-muted-foreground">Alta Priorità</p>
                <p className="text-xl font-bold text-warning">{highPriorityTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Settings className="w-6 h-6 text-success mr-2" />
              <div>
                <p className="text-sm text-muted-foreground">Attività Totali</p>
                <p className="text-xl font-bold text-success">{currentSuggestions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 items-center">
        <Select value={selectedGoal} onValueChange={setSelectedGoal}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Seleziona obiettivo" />
          </SelectTrigger>
          <SelectContent>
            {goals.map(goal => (
              <SelectItem key={goal.id} value={goal.id}>
                {goal.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedProperty} onValueChange={setSelectedProperty}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Filtra per proprietà" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le proprietà</SelectItem>
            <SelectItem value="via-roma-123">Via Roma 123</SelectItem>
            <SelectItem value="corso-milano-45">Corso Milano 45</SelectItem>
            <SelectItem value="via-verdi-78">Via Verdi 78</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {goals.find(g => g.id === selectedGoal)?.icon && (
              React.createElement(goals.find(g => g.id === selectedGoal)!.icon, { className: "w-5 h-5" })
            )}
            Piano per: {goals.find(g => g.id === selectedGoal)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {currentSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{suggestion.title}</h3>
                      <StatusBadge variant={getPriorityVariant(suggestion.priority) as any}>
                        {suggestion.priority}
                      </StatusBadge>
                      <StatusBadge variant="outline">{suggestion.category}</StatusBadge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        {suggestion.property}
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {suggestion.timeframe}
                      </div>
                      <div className="flex items-center">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        €{suggestion.estimatedCost}
                      </div>
                    </div>
                    
                    <p className="text-foreground mb-2">{suggestion.description}</p>
                    <div className="bg-info-subtle p-2 rounded text-sm">
                      <strong>Impatto previsto:</strong> {suggestion.impact}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-4">
                    <Button size="sm">
                      Programma
                    </Button>
                    <Button variant="outline" size="sm">
                      Dettagli
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {currentSuggestions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nessuna attività suggerita per questo obiettivo al momento.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SuggestedPlan;
