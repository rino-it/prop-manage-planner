import React, { useState } from 'react';
import { useTenants } from '@/hooks/useTenants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Users, Star, AlertTriangle, Save } from 'lucide-react';

export default function TenantManager() {
  const { tenants, isLoading, updateProfile } = useTenants();
  const [editingNote, setEditingNote] = useState<{id: string, text: string} | null>(null);

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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Gestione Inquilini</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? <p>Caricamento...</p> : tenants?.map((booking) => {
          const profile = booking.tenant_profiles?.[0]; // Relazione 1:1
          if (!profile) return null;

          return (
            <Card key={booking.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      {booking.nome_ospite}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">{booking.properties_real?.nome}</p>
                  </div>
                  <Badge variant="outline" className={profile.compliance_score < 60 ? "bg-red-50 text-red-600 border-red-200" : "bg-green-50 text-green-600 border-green-200"}>
                    Score: {profile.compliance_score}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Punteggio Visivo */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Affidabilità</span>
                    <span className="font-bold">{profile.compliance_score}/100</span>
                  </div>
                  <Progress value={profile.compliance_score} className="h-2" indicatorColor={getScoreColor(profile.compliance_score)} />
                </div>

                {/* Statistiche Rapide */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-50 p-2 rounded border flex flex-col items-center">
                        <span className="text-gray-400 text-xs">Pagamenti</span>
                        <div className="flex mt-1">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`w-3 h-3 ${i < (profile.payment_reliability || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                            ))}
                        </div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded border flex flex-col items-center">
                        <span className="text-gray-400 text-xs">Ticket Mese</span>
                        <span className={`font-bold ${profile.ticket_frequency > 2 ? 'text-red-500' : 'text-gray-700'}`}>
                            {profile.ticket_frequency || 0}
                        </span>
                    </div>
                </div>

                {/* Note Proprietario */}
                <div className="space-y-2">
                    <span className="text-xs font-bold text-gray-500 uppercase">Note Private</span>
                    {editingNote?.id === profile.id ? (
                        <div className="flex gap-2">
                            <Textarea 
                                value={editingNote.text} 
                                onChange={(e) => setEditingNote({ ...editingNote, text: e.target.value })}
                                className="min-h-[80px] text-sm"
                            />
                            <Button size="icon" onClick={() => handleSaveNote(profile.id)}>
                                <Save className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <div 
                            className="bg-yellow-50/50 p-3 rounded-md border border-yellow-100 text-sm text-gray-600 min-h-[60px] cursor-pointer hover:bg-yellow-50 transition-colors"
                            onClick={() => setEditingNote({ id: profile.id, text: profile.owner_notes || '' })}
                        >
                            {profile.owner_notes || "Clicca per aggiungere una nota..."}
                        </div>
                    )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {tenants?.length === 0 && (
             <div className="col-span-full text-center py-12 border-2 border-dashed rounded-xl bg-gray-50 text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Nessun inquilino a lungo termine trovato.</p>
                <p className="text-xs mt-2">Crea una prenotazione di tipo "Lungo Termine" per vederla qui.</p>
             </div>
        )}
      </div>
    </div>
  );
}