import React from 'react';
import { useSmartPlanner } from '@/hooks/useSmartPlanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingUp, AlertTriangle, Calendar, CheckCircle } from 'lucide-react';

export default function SuggestedPlan() {
  const { suggestions, count } = useSmartPlanner();

  const totalCost = suggestions.reduce((acc, s) => acc + s.estimated_cost, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Smart Planner</h1>
            <p className="text-gray-500">Il sistema ha analizzato i tuoi dati e suggerisce queste azioni.</p>
        </div>
        <Button>Genera Report PDF</Button>
      </div>

      {/* KPI PREVISIONALI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-full text-blue-700"><Lightbulb /></div>
            <div>
                <p className="text-sm text-blue-700 font-medium">Azioni Suggerite</p>
                <h2 className="text-3xl font-bold text-blue-900">{count}</h2>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-full text-orange-700"><TrendingUp /></div>
            <div>
                <p className="text-sm text-orange-700 font-medium">Stima Costi</p>
                <h2 className="text-3xl font-bold text-orange-900">€ {totalCost.toLocaleString()}</h2>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-full text-purple-700"><Calendar /></div>
            <div>
                <p className="text-sm text-purple-700 font-medium">Risparmio Potenziale</p>
                <h2 className="text-3xl font-bold text-purple-900">€ {(totalCost * 0.2).toLocaleString()}</h2>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LISTA SUGGERIMENTI */}
      <div className="grid gap-4">
        {suggestions.map((item) => (
            <Card key={item.id} className="border-l-4 hover:shadow-md transition" style={{ borderLeftColor: item.priority === 'alta' ? '#ef4444' : '#eab308' }}>
                <CardContent className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg">{item.title}</h3>
                            <Badge variant="outline" className={item.priority === 'alta' ? 'text-red-600 bg-red-50' : 'text-yellow-600 bg-yellow-50'}>
                                {item.priority.toUpperCase()}
                            </Badge>
                            <Badge variant="secondary">{item.type}</Badge>
                        </div>
                        <p className="text-gray-600">{item.description}</p>
                        <p className="text-xs text-gray-400 mt-2">Rilevato su: {item.property_name}</p>
                    </div>
                    
                    <div className="text-right min-w-[120px]">
                        <p className="text-sm text-gray-500">Costo Stimato</p>
                        <p className="font-bold text-lg">€ {item.estimated_cost}</p>
                        <Button size="sm" className="mt-2 w-full" variant="outline">
                            <CheckCircle className="w-4 h-4 mr-2" /> Esegui
                        </Button>
                    </div>
                </CardContent>
            </Card>
        ))}

        {suggestions.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed rounded-xl bg-gray-50 text-green-600">
                <CheckCircle className="w-12 h-12 mx-auto mb-4" />
                <p className="text-lg font-medium">Tutto perfetto!</p>
                <p className="text-sm opacity-70">Il sistema non rileva criticità o scadenze imminenti.</p>
            </div>
        )}
      </div>
    </div>
  );
}