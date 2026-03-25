import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  FileCheck, FileX, Download, Loader2, Inbox, Eye, User, Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface BookingDocument {
  id: string;
  booking_id: string;
  file_url: string;
  file_name: string;
  status: string;
  created_at: string;
  ai_doc_type?: string;
  ai_extracted_name?: string;
  bookings?: {
    id: string;
    nome_ospite: string;
    data_inizio: string;
    data_fine: string;
    properties_real?: {
      nome: string;
    };
  };
}

export default function DocumentApproval() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ['pending-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_documents')
        .select('*, bookings(id, nome_ospite, data_inizio, data_fine, properties_real(nome))')
        .in('status', ['pending', 'uploaded'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BookingDocument[];
    },
  });

  const { data: recentDocuments } = useQuery({
    queryKey: ['recent-reviewed-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_documents')
        .select('*, bookings(id, nome_ospite, data_inizio, data_fine, properties_real(nome))')
        .in('status', ['approved', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as BookingDocument[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ docId, status, bookingId }: { docId: string; status: string; bookingId: string }) => {
      const { error: docError } = await supabase
        .from('booking_documents')
        .update({ status } as any)
        .eq('id', docId);
      if (docError) throw docError;

      if (status === 'approved') {
        const { data: allDocs } = await supabase
          .from('booking_documents')
          .select('status')
          .eq('booking_id', bookingId);

        const allApproved = allDocs?.every((d: any) => d.status === 'approved');
        if (allApproved) {
          await supabase
            .from('bookings')
            .update({ documents_approved: true, stato_documenti: 'approvato' } as any)
            .eq('id', bookingId);
        } else {
          await supabase
            .from('bookings')
            .update({ stato_documenti: 'in_revisione' } as any)
            .eq('id', bookingId);
        }
      } else if (status === 'rejected') {
        await supabase
          .from('bookings')
          .update({ documents_approved: false, stato_documenti: 'rifiutato' } as any)
          .eq('id', bookingId);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pending-documents'] });
      queryClient.invalidateQueries({ queryKey: ['recent-reviewed-documents'] });
      const action = variables.status === 'approved' ? 'approvato' : 'rifiutato';
      toast({ title: `Documento ${action}`, description: `Il documento e stato ${action} con successo.` });
    },
    onError: (err: any) => {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    },
  });

  const downloadDocument = async (fileUrl: string) => {
    try {
      const path = fileUrl.startsWith('http') ? fileUrl : fileUrl;
      if (fileUrl.startsWith('http')) {
        window.open(fileUrl, '_blank');
        return;
      }
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(path, 300);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      toast({ title: 'Errore download', description: err.message, variant: 'destructive' });
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-100 text-green-700 border-green-200">Approvato</Badge>;
      case 'rejected': return <Badge className="bg-red-100 text-red-700 border-red-200">Rifiutato</Badge>;
      default: return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">In attesa</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Caricamento documenti...
      </div>
    );
  }

  const pendingCount = documents?.length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Approvazione Documenti</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Verifica e approva i documenti caricati dagli ospiti per il check-in.
        </p>
      </div>

      {pendingCount === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">
              Nessun documento in attesa di approvazione.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{pendingCount}</Badge>
            <span className="text-sm text-muted-foreground">documenti in attesa</span>
          </div>

          {documents?.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="pt-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{doc.file_name || 'Documento'}</span>
                      {statusBadge(doc.status)}
                      {doc.ai_doc_type && (
                        <Badge variant="outline" className="text-xs">
                          AI: {doc.ai_doc_type}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {doc.bookings?.nome_ospite && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {doc.bookings.nome_ospite}
                        </span>
                      )}
                      {doc.bookings?.properties_real?.nome && (
                        <span className="flex items-center gap-1">
                          @ {doc.bookings.properties_real.nome}
                        </span>
                      )}
                      {doc.bookings?.data_inizio && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(doc.bookings.data_inizio), 'dd MMM yyyy', { locale: it })}
                        </span>
                      )}
                      {doc.ai_extracted_name && (
                        <span>Nome estratto: {doc.ai_extracted_name}</span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Caricato il {format(new Date(doc.created_at), "dd MMM yyyy 'alle' HH:mm", { locale: it })}
                    </p>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadDocument(doc.file_url)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> Visualizza
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={updateStatusMutation.isPending}
                      onClick={() => updateStatusMutation.mutate({
                        docId: doc.id,
                        status: 'approved',
                        bookingId: doc.booking_id,
                      })}
                    >
                      <FileCheck className="w-3.5 h-3.5 mr-1" /> Approva
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={updateStatusMutation.isPending}
                      onClick={() => updateStatusMutation.mutate({
                        docId: doc.id,
                        status: 'rejected',
                        bookingId: doc.booking_id,
                      })}
                    >
                      <FileX className="w-3.5 h-3.5 mr-1" /> Rifiuta
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {recentDocuments && recentDocuments.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-lg font-semibold mb-3">Revisioni recenti</h3>
            <div className="space-y-2">
              {recentDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 text-sm">
                  <div className="flex items-center gap-3">
                    {statusBadge(doc.status)}
                    <span>{doc.file_name || 'Documento'}</span>
                    {doc.bookings?.nome_ospite && (
                      <span className="text-muted-foreground">- {doc.bookings.nome_ospite}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(doc.created_at), 'dd/MM/yy', { locale: it })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
