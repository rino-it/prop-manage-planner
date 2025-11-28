import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar as CalendarIcon, Plus, Copy, Eye, Check, X, FileText, Palmtree, Home, Pencil, Trash2, Save } from 'lucide-react';
import { format, isBefore, startOfDay } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { usePropertiesReal } from '@/hooks/useProperties';
import { Badge } from '@/components/ui/badge';

export default function Bookings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: properties } = usePropertiesReal();
  
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState<string | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<any[]>([]);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    property_id: '', nome_ospite: '', email_ospite: '', telefono_ospite: '',
    data_inizio: undefined as Date | undefined, data_fine: undefined as Date | undefined, 
    tipo_affitto: 'breve'
  });

  // QUERY: Leggi prenotazioni
  const { data: bookings } = useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const { data } = await supabase.from('bookings').select('*, properties_real(nome)').order('created_at', { ascending: false });
      return data || [];
    }
  });

  // LOGICA ANTI-OVERBOOKING (Calcola date occupate)
  const getOccupiedDates = (propertyId: string, excludeBookingId?: string) => {
    if (!bookings || !propertyId) return [];
    
    return bookings
      .filter(b => b.property_id === propertyId && b.id !== excludeBookingId) // Escludi se stesso in modifica
      .map(b => ({
        from: new Date(b.data_inizio),
        to: new Date(b.data_fine)
      }));
  };

  const createBooking = useMutation({
    mutationFn: async (newBooking: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('bookings').insert({ ...newBooking, user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setNewBookingOpen(false);
      toast({ title: 'Prenotazione creata' });
      setFormData({
        property_id: '', nome_ospite: '', email_ospite: '', telefono_ospite: '',
        data_inizio: undefined, data_fine: undefined, tipo_affitto: 'breve'
      });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" })
  });

  const updateBooking = useMutation({
    mutationFn: async (updatedData: any) => {
      const { error } = await supabase
        .from('bookings')
        .update({
          data_inizio: format(updatedData.data_inizio, 'yyyy-MM-dd'),
          data_fine: format(updatedData.data_fine, 'yyyy-MM-dd'),
          email_ospite: updatedData.email_ospite,
          telefono_ospite: updatedData.telefono_ospite,
          tipo_affitto: updatedData.tipo_affitto
        })
        .eq('id', updatedData.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setEditingBooking(null);
      toast({ title: 'Prenotazione aggiornata' });
    },
    onError: (err: any) => toast({ title: "Errore modifica", description: err.message, variant: "destructive" })
  });

  const deleteBooking = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setDeleteId(null);
      toast({ title: 'Prenotazione eliminata', variant: "destructive" });
    },
    onError: (err: any) => toast({ title: "Errore eliminazione", description: err.message, variant: "destructive" })
  });

  const loadDocuments = async (bookingId: string) => {
    const { data } = await supabase.from('booking_documents').select('*').eq('booking_id', bookingId).order('uploaded_at', { ascending: false });
    setSelectedDocs(data || []);
    setReviewOpen(bookingId);
  };

  const reviewDoc = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from('booking_documents').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Stato Aggiornato" });
      if (reviewOpen) loadDocuments(reviewOpen);
    }
  });

  const handleSubmit = () => {
    if (!formData.property_id || !formData.data_inizio || !formData.data_fine || !formData.nome_ospite) {
        toast({ title: "Dati mancanti", variant: "destructive" });
        return;
    }
    createBooking.mutate({
      property_id: formData.property_id,
      nome_ospite: formData.nome_ospite,
      email_ospite: formData.email_ospite,
      telefono_ospite: formData.telefono_ospite,
      data_inizio: format(formData.data_inizio, 'yyyy-MM-dd'),
      data_fine: format(formData.data_fine, 'yyyy-MM-dd'),
      tipo_affitto: formData.tipo_affitto,
    });
  };

  const copyLink = (booking: any) => {
    const baseUrl = window.location.origin;
    const path = booking.tipo_affitto === 'breve' ? '/guest/' : '/tenant/';
    const fullUrl = `${baseUrl}${path}${booking.id}`;
    navigator.clipboard.writeText(fullUrl);
    toast({ title: "Link Copiato!" });
  };

  const getDocUrl = (path: string) => supabase.storage.from('documents').getPublicUrl(path).data.publicUrl;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Prenotazioni</h1>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setNewBookingOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nuova
        </Button>
      </div>

      {/* DIALOG NUOVA PRENOTAZIONE */}
      <Dialog open={newBookingOpen} onOpenChange={setNewBookingOpen}>
        <DialogContent className="sm:max-w-[600px]">
            <DialogHeader><DialogTitle>Nuova Prenotazione</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <Label className="text-slate-700 font-bold mb-2 block">Tipo Contratto</Label>
                <Select onValueChange={(v) => setFormData({...formData, tipo_affitto: v})} defaultValue="breve">
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="breve">🏖️ Affitto Breve (Turistico)</SelectItem>
                        <SelectItem value="lungo">🏠 Lungo Termine (Inquilino)</SelectItem>
                    </SelectContent>
                </Select>
                </div>
                <div className="grid gap-2">
                <Label>Immobile</Label>
                <Select onValueChange={(v) => setFormData({...formData, property_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                    <SelectContent>{properties?.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>))}</SelectContent>
                </Select>
                </div>
                <div className="grid gap-2">
                <Label>Ospite / Inquilino</Label>
                <Input value={formData.nome_ospite} onChange={e => setFormData({...formData, nome_ospite: e.target.value})} placeholder="Nome Cognome" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Check-in / Inizio</Label>
                        <Popover>
                            <PopoverTrigger asChild><Button variant={"outline"} className={!formData.property_id ? "opacity-50 cursor-not-allowed" : ""}>{formData.data_inizio ? format(formData.data_inizio, "dd/MM/yyyy") : "Data"}</Button></PopoverTrigger>
                            <PopoverContent className="p-0">
                                <Calendar 
                                    mode="single" 
                                    selected={formData.data_inizio} 
                                    onSelect={(d) => setFormData({...formData, data_inizio: d})} 
                                    disabled={[...getOccupiedDates(formData.property_id), { before: new Date() }]} 
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="grid gap-2">
                        <Label>Check-out / Fine</Label>
                        <Popover>
                            <PopoverTrigger asChild><Button variant={"outline"} className={!formData.data_inizio ? "opacity-50 cursor-not-allowed" : ""}>{formData.data_fine ? format(formData.data_fine, "dd/MM/yyyy") : "Data"}</Button></PopoverTrigger>
                            <PopoverContent className="p-0">
                                <Calendar 
                                    mode="single" 
                                    selected={formData.data_fine} 
                                    onSelect={(d) => setFormData({...formData, data_fine: d})} 
                                    disabled={[...getOccupiedDates(formData.property_id), { before: formData.data_inizio || new Date() }]} 
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <Button onClick={handleSubmit} className="w-full bg-blue-600" disabled={!formData.property_id}>Salva</Button>
            </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG MODIFICA PRENOTAZIONE */}
      {editingBooking && (
        <Dialog open={!!editingBooking} onOpenChange={(open) => !open && setEditingBooking(null)}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader><DialogTitle>Modifica Prenotazione</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-100 rounded border border-gray-200">
                        <div>
                            <Label className="text-gray-500 text-xs uppercase">Immobile (Bloccato)</Label>
                            <p className="font-bold text-gray-700">{editingBooking.properties_real?.nome}</p>
                        </div>
                        <div>
                            <Label className="text-gray-500 text-xs uppercase">Ospite (Bloccato)</Label>
                            <p className="font-bold text-gray-700">{editingBooking.nome_ospite}</p>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Tipo Contratto</Label>
                        <Select value={editingBooking.tipo_affitto} onValueChange={(v) => setEditingBooking({...editingBooking, tipo_affitto: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="breve">Affitto Breve</SelectItem><SelectItem value="lungo">Lungo Termine</SelectItem></SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2"><Label>Email</Label><Input value={editingBooking.email_ospite || ''} onChange={e => setEditingBooking({...editingBooking, email_ospite: e.target.value})} /></div>
                        <div className="grid gap-2"><Label>Telefono</Label><Input value={editingBooking.telefono_ospite || ''} onChange={e => setEditingBooking({...editingBooking, telefono_ospite: e.target.value})} /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Inizio</Label>
                            <Popover>
                                <PopoverTrigger asChild><Button variant={"outline"}>{editingBooking.data_inizio ? format(new Date(editingBooking.data_inizio), "dd/MM/yyyy") : "Data"}</Button></PopoverTrigger>
                                <PopoverContent className="p-0">
                                    <Calendar 
                                        mode="single" 
                                        selected={new Date(editingBooking.data_inizio)} 
                                        onSelect={(d) => d && setEditingBooking({...editingBooking, data_inizio: d})} 
                                        disabled={getOccupiedDates(editingBooking.property_id, editingBooking.id)} 
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="grid gap-2">
                            <Label>Fine</Label>
                            <Popover>
                                <PopoverTrigger asChild><Button variant={"outline"}>{editingBooking.data_fine ? format(new Date(editingBooking.data_fine), "dd/MM/yyyy") : "Data"}</Button></PopoverTrigger>
                                <PopoverContent className="p-0">
                                    <Calendar 
                                        mode="single" 
                                        selected={new Date(editingBooking.data_fine)} 
                                        onSelect={(d) => d && setEditingBooking({...editingBooking, data_fine: d})} 
                                        disabled={[...getOccupiedDates(editingBooking.property_id, editingBooking.id), { before: new Date(editingBooking.data_inizio) }]}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <Button onClick={() => updateBooking.mutate(editingBooking)} className="w-full bg-orange-600 hover:bg-orange-700">
                        <Save className="w-4 h-4 mr-2" /> Salva Modifiche
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
      )}

      {/* DIALOG REVISIONE DOCUMENTI (Invariato) */}
      <Dialog open={!!reviewOpen} onOpenChange={(open) => !open && setReviewOpen(null)}>
        <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Revisione Documenti</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {selectedDocs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="p-2 bg-white rounded border"><FileText className="w-6 h-6 text-blue-600" /></div>
                            <div className="min-w-0">
                                <p className="font-medium text-sm truncate max-w-[200px]">{doc.filename}</p>
                                <p className="text-xs text-gray-500">{format(new Date(doc.uploaded_at), 'dd MMM HH:mm')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => window.open(getDocUrl(doc.file_url), '_blank')}><Eye className="w-4 h-4" /></Button>
                            {doc.status === 'in_revisione' ? (
                                <><Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => reviewDoc.mutate({ id: doc.id, status: 'approvato' })}><Check className="w-4 h-4" /></Button><Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => reviewDoc.mutate({ id: doc.id, status: 'rifiutato' })}><X className="w-4 h-4" /></Button></>
                            ) : (<Badge variant={doc.status === 'approvato' ? 'default' : 'destructive'}>{doc.status.toUpperCase()}</Badge>)}
                        </div>
                    </div>
                ))}
                {selectedDocs.length === 0 && <p className="text-center text-gray-500 py-10">Nessun documento caricato.</p>}
            </div>
        </DialogContent>
      </Dialog>

      {/* ALERT ELIMINAZIONE */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Sei sicuro?</AlertDialogTitle><AlertDialogDescription>Azione irreversibile.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction onClick={() => deleteId && deleteBooking.mutate(deleteId)} className="bg-red-600 hover:bg-red-700">Elimina</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* LISTA BOOKINGS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {bookings?.map((booking) => {
            const isShort = booking.tipo_affitto === 'breve';
            return (
            <Card key={booking.id} className={`border-l-4 shadow-sm ${isShort ? 'border-l-orange-400' : 'border-l-purple-500'}`}>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                <div><CardTitle className="text-lg font-bold text-gray-800">{booking.nome_ospite}</CardTitle><p className="text-sm text-gray-500 mt-1">{booking.properties_real?.nome}</p></div>
                <Badge variant="secondary" className={isShort ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}>{isShort ? 'Turista' : 'Inquilino'}</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                <div className="text-sm text-gray-600 flex items-center gap-2 bg-gray-50 p-2 rounded"><CalendarIcon className="w-4 h-4 text-gray-400" />{format(new Date(booking.data_inizio), 'dd MMM')} - {format(new Date(booking.data_fine), 'dd MMM yyyy')}</div>
                <div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" onClick={() => copyLink(booking)}><Copy className="w-4 h-4 mr-2" /> Link</Button><Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => loadDocuments(booking.id)}><FileText className="w-4 h-4 mr-2" /> Doc ({selectedDocs.length || '?'})</Button></div>
                <div className="flex justify-end gap-2 border-t pt-3"><Button variant="ghost" size="sm" className="text-gray-500 hover:text-orange-600" onClick={() => setEditingBooking(booking)}><Pencil className="w-4 h-4 mr-1" /> Modifica</Button><Button variant="ghost" size="sm" className="text-gray-500 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteId(booking.id)}><Trash2 className="w-4 h-4" /></Button></div>
                </div>
            </CardContent>
            </Card>
            );
        })}
      </div>
    </div>
  );
}