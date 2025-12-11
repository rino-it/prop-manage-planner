import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle, XCircle, Shield, User, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function Team() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth(); // Recuperiamo l'utente loggato

  // 1. CARICA LISTA SOCI
  const { data: team, isLoading } = useQuery({
    queryKey: ['team-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // 2. CAPISCI CHI SONO IO (IL MIO RUOLO)
  const myProfile = team?.find(p => p.id === user?.id);
  const amIAdmin = myProfile?.role === 'admin';

  // Mutation: Approva / Blocca
  const toggleApproval = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: boolean }) => {
      const { error } = await supabase.from('profiles').update({ approved: status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-list'] });
      toast({ title: "Stato aggiornato", description: "Permessi modificati con successo." });
    },
    onError: () => toast({ title: "Azione Negata", description: "Solo gli Admin possono modificare il team.", variant: "destructive" })
  });

  if (isLoading) return <div className="p-8 text-center">Caricamento team...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestione Team</h1>
            <p className="text-gray-500">
                {amIAdmin 
                    ? "Hai i permessi di Amministratore. Puoi gestire gli accessi." 
                    : "Visualizza i membri del team attivi."}
            </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {team?.map((member) => {
            // Regola di Sicurezza Visiva:
            // 1. Devi essere Admin per vedere i tasti.
            // 2. Non puoi toccare un altro Admin (Protezione Suprema).
            const isTargetAdmin = member.role === 'admin';
            const showActions = amIAdmin && !isTargetAdmin;

            return (
              <Card key={member.id} className={`border-l-4 ${member.approved ? 'border-l-green-500' : 'border-l-yellow-500'} ${isTargetAdmin ? 'bg-slate-50' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border">
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback className={`font-bold ${isTargetAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {member.first_name?.[0]}{member.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            {member.first_name} {member.last_name}
                            {isTargetAdmin && <Shield className="w-4 h-4 text-purple-600" fill="currentColor" className="opacity-20" />}
                        </CardTitle>
                        <CardDescription className="uppercase text-[10px] font-bold tracking-wider">
                            {member.role || 'Staff'}
                        </CardDescription>
                      </div>
                    </div>
                    {member.approved 
                        ? <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Attivo</Badge> 
                        : <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200">In Attesa</Badge>
                    }
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="text-sm text-gray-600 space-y-1 mb-4">
                    <p className="flex items-center gap-2"><User className="w-4 h-4"/> {member.email}</p>
                    <p className="flex items-center gap-2"><Shield className="w-4 h-4"/> {member.phone || 'Nessun telefono'}</p>
                  </div>
                  
                  {/* ZONA AZIONI (Protetta) */}
                  <div className="h-10">
                      {showActions ? (
                        <div className="flex gap-2">
                            {member.approved ? (
                                <Button 
                                    variant="outline" 
                                    className="w-full text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => toggleApproval.mutate({ id: member.id, status: false })}
                                >
                                    <XCircle className="w-4 h-4 mr-2" /> Blocca
                                </Button>
                            ) : (
                                <Button 
                                    className="w-full bg-green-600 hover:bg-green-700"
                                    onClick={() => toggleApproval.mutate({ id: member.id, status: true })}
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" /> Approva
                                </Button>
                            )}
                        </div>
                      ) : (
                        // Placeholder per chi non può agire
                        <div className="flex items-center justify-center text-xs text-gray-400 h-full border border-dashed rounded bg-slate-50">
                            {isTargetAdmin ? <span className="flex items-center gap-1"><Lock className="w-3 h-3"/> Profilo Protetto (Admin)</span> : <span>Solo lettura</span>}
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