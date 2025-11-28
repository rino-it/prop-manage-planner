import React, { useState } from 'react';
import { useTenants } from '@/hooks/useTenants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Users, Star, Save, ArrowRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TenantManager() {
  const { tenants, isLoading, updateProfile } = useTenants();
  const [editingNote, setEditingNote] = useState<{id: string, text: string} | null>(null);
  const navigate = useNavigate();

  const handleSaveNote = (profileId: string) => {
    if (!editingNote) return;
    updateProfile.mutate({ 
      id: profileId, 
      updates: { owner_notes: editingNote.text } 
    });
    setEditingNote(null);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Caricamento inquilini...</div>;

  // EMPTY STATE
  if (!tenants || tenants.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Inquilini</h1>
        <Card className="border-dashed border-2 bg-slate-50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-white p-4 rounded-full shadow-sm mb-4">
              <Users className="w-12 h-12 text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Nessun Inquilino Lungo Termine</h2>
            <p className="text-slate-500 max-w-md mt-2 mb-6">
              Assicurati di avere prenotazioni con "Tipo Contratto: Lungo Termine".
            </p>
            <Button onClick={() => navigate('/bookings')} className="bg-blue-600 hover:bg-blue-700">
              Vai a Prenotazioni <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Inquilini</h1>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1">
          {tenants?.length} Attivi
        </Badge>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tenants.map((booking) => {
          const profile = booking.tenant_profiles?.[0]; 
          
          // Valori di default (Fallback)
          const score = profile?.compliance_score ?? 100;
          const reliability = profile?.payment_reliability ?? 5;
          const tickets = profile?.ticket_frequency ?? 0;
          const notes = profile?.owner_notes ?? '';
          const profileId = profile?.id;

          return (
            <Card key={booking.id} className="hover:shadow-lg transition-all duration-200 border-t-4 border-t-blue-500">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      {booking.nome_ospite}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">{booking.properties_real?.nome || 'Immobile sconosciuto'}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-gray-400 uppercase font-bold mb-1">Score</span>
                    <span className={`text-2xl font-bold ${score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {score}
                    </span>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div>
                  <Progress value={score} className="h-2" indicatorColor={getScoreColor(score)} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-lg border flex flex-col items-center justify-center">
                        <span className="text-slate-500 text-xs mb-1">Affidabilità</span>
                        <div className="flex">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`w-4 h-4 ${i < reliability ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                            ))}
                        </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border flex flex-col items-center justify-center">
                        <span className="text-slate-500 text-xs mb-1">Ticket Mese</span>
                        <span className={`font-bold text-lg ${tickets > 2 ? 'text-red-500' : 'text-slate-700'}`}>
                            {tickets}
                        </span>
                    </div>
                </div>

                <div className="space-y-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Note Private</span>
                    
                    {!profileId ? (
                        <div className="bg-red-50 p-3 rounded text-xs text-red-600 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Dati profilo mancanti (Rigenera da DB)
                        </div>
                    ) : editingNote?.id === profileId ? (
                        <div className="flex gap-2 items-start">
                            <Textarea 
                                value={editingNote.text} 
                                onChange={(e) => setEditingNote({ ...editingNote, text: e.target.value })}
                                className="min-h-[80px] text-sm bg-yellow-50 border-yellow-200 focus:border-yellow-400"
                            />
                            <Button size="icon" className="h-8 w-8 bg-blue-600" onClick={() => handleSaveNote(profileId)}>
                                <Save className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <div 
                            className="bg-yellow-50 p-3 rounded-md border border-yellow-100 text-sm text-gray-700 min-h-[60px] cursor-pointer hover:bg-yellow-100/50 transition-colors relative group"
                            onClick={() => setEditingNote({ id: profileId, text: notes })}
                        >
                            {notes || <span className="text-gray-400 italic">Clicca per scrivere una nota...</span>}
                            <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-xs text-yellow-600">Modifica</span>
                        </div>
                    )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}