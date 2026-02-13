import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle, XCircle, Shield, User, Lock, Crown, Ban, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function Team() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth(); 

  const { data: team, isLoading } = useQuery({
    queryKey: ['team-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const myProfile = team?.find(p => p.id === user?.id);
  const amIAdmin = myProfile?.role === 'admin';

  // Mutation: Cambia Stato (Active, Pending, Rejected)
  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      // Aggiorniamo sia 'status' che 'approved' per mantenere retrocompatibilità
      const isApproved = status === 'active';
      const { error } = await supabase.from('profiles').update({ status: status, approved: isApproved }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-list'] });
      toast({ title: "Stato utente aggiornato" });
    },
    onError: () => toast({ title: "Errore", variant: "destructive" })
  });

  const changeRole = useMutation({
    mutationFn: async ({ id, newRole }: { id: string, newRole: string }) => {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-list'] })
  });

  if (isLoading) return <div className="p-8 text-center">Caricamento team...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-gray-900">Gestione Team</h1><p className="text-gray-500">{amIAdmin ? "Gestisci accessi e ruoli." : "Visualizza i membri del team."}</p></div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {team?.map((member) => {
            const isTargetAdmin = member.role === 'admin';
            const isMe = member.id === user?.id;
            const canEdit = amIAdmin && !isMe;
            
            // Colore Card in base allo stato
            let borderColor = 'border-l-yellow-500'; // Pending
            if (member.status === 'active') borderColor = 'border-l-green-500';
            if (member.status === 'rejected') borderColor = 'border-l-red-500';

            return (
              <Card key={member.id} className={`border-l-4 ${borderColor} ${isTargetAdmin ? 'bg-purple-50/30' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border"><AvatarImage src={member.avatar_url} /><AvatarFallback className="bg-slate-100">{member.first_name?.[0]}{member.last_name?.[0]}</AvatarFallback></Avatar>
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">{member.first_name} {member.last_name} {isTargetAdmin && <Crown className="w-4 h-4 text-purple-600" fill="currentColor" />}</CardTitle>
                        {canEdit ? (
                            <div className="mt-1"><Select defaultValue={member.role} onValueChange={(val) => changeRole.mutate({ id: member.id, newRole: val })}><SelectTrigger className="h-6 text-xs w-[100px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="staff">Staff</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>
                        ) : (<CardDescription className="uppercase text-[10px] font-bold tracking-wider mt-1">{member.role || 'Staff'}</CardDescription>)}
                      </div>
                    </div>
                    {/* BADGE STATO */}
                    {member.status === 'active' && <Badge className="bg-green-100 text-green-700">Attivo</Badge>}
                    {member.status === 'pending' && <Badge className="bg-yellow-100 text-yellow-700">In Attesa</Badge>}
                    {member.status === 'rejected' && <Badge className="bg-red-100 text-red-700">Rifiutato</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="text-sm text-gray-600 space-y-1 mb-4">
                    <p className="flex items-center gap-2"><User className="w-4 h-4"/> {member.email}</p>
                    <p className="flex items-center gap-2"><Shield className="w-4 h-4"/> {member.phone || 'Nessun telefono'}</p>
                  </div>
                  
                  {/* PULSANTIERA AZIONI */}
                  <div className="h-10">
                      {canEdit ? (
                        <div className="flex gap-2 w-full">
                            {member.status === 'pending' && (
                                <>
                                    <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => changeStatus.mutate({ id: member.id, status: 'active' })}><CheckCircle className="w-4 h-4 mr-2" /> Approva</Button>
                                    <Button size="sm" variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => changeStatus.mutate({ id: member.id, status: 'rejected' })}><Ban className="w-4 h-4 mr-2" /> Rifiuta</Button>
                                </>
                            )}
                            {member.status === 'active' && (
                                <Button size="sm" variant="outline" className="w-full text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => changeStatus.mutate({ id: member.id, status: 'pending' })}><XCircle className="w-4 h-4 mr-2" /> Sospendi</Button>
                            )}
                            {member.status === 'rejected' && (
                                <Button size="sm" variant="outline" className="w-full text-green-600 border-green-200 hover:bg-green-50" onClick={() => changeStatus.mutate({ id: member.id, status: 'active' })}><CheckCircle className="w-4 h-4 mr-2" /> Riammetti</Button>
                            )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center text-xs text-gray-400 h-full border border-dashed rounded bg-slate-50">{isMe ? <span>Il tuo profilo</span> : <span className="flex items-center gap-1"><Lock className="w-3 h-3"/> Solo Admin</span>}</div>
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