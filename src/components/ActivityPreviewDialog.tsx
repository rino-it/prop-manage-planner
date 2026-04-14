import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Home, Truck, Calendar, Paperclip, StickyNote,
  UserCog, Eye, Users
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface ActivityPreviewDialogProps {
  ticket: any;
  isOpen: boolean;
  onClose: () => void;
  onManage: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critica: 'bg-red-100 text-red-800 border-red-200',
  alta:    'bg-red-100 text-red-800 border-red-200',
  media:   'bg-amber-100 text-amber-800 border-amber-200',
  bassa:   'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const PRIORITY_BAR: Record<string, string> = {
  critica: 'bg-red-500',
  alta:    'bg-red-400',
  media:   'bg-amber-400',
  bassa:   'bg-emerald-500',
};

const STATUS_COLORS: Record<string, string> = {
  aperto:      'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_corso:    'bg-blue-100 text-blue-800 border-blue-200',
  in_attesa:   'bg-orange-100 text-orange-800 border-orange-200',
  in_verifica: 'bg-purple-100 text-purple-800 border-purple-200',
  risolto:     'bg-green-100 text-green-800 border-green-200',
};

const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer"
        className="text-blue-600 underline hover:text-blue-800 break-all">{part}</a>
    ) : part
  );
};

export default function ActivityPreviewDialog({
  ticket, isOpen, onClose, onManage
}: ActivityPreviewDialogProps) {
  if (!ticket) return null;

  const isResolved = ticket.stato === 'risolto';
  const isMobile   = !!ticket.properties_mobile;
  const propertyName = isMobile
    ? `${ticket.properties_mobile?.veicolo} (${ticket.properties_mobile?.targa})`
    : ticket.properties_real?.nome || ticket.bookings?.properties_real?.nome || '—';

  // Fetch team members per mostrare nomi assegnati
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-list'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name');
      return data?.map(u => ({
        id: u.id,
        label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Utente',
        initials: `${u.first_name?.charAt(0) || ''}${u.last_name?.charAt(0) || ''}`.toUpperCase()
      })) || [];
    }
  });

  const assignees = (ticket.assigned_to || [])
    .map((id: string) => teamMembers.find(m => m.id === id))
    .filter(Boolean);

  const openFile = async (path: string) => {
    const bucket = path.startsWith('ticket_doc_') ? 'ticket-files' : 'documents';
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md w-[95vw] p-0 overflow-hidden">

        {/* Barra priorità top */}
        <div className={`h-1 w-full ${PRIORITY_BAR[ticket.priorita] || 'bg-slate-200'}`} />

        <div className="px-6 pt-4 pb-6 space-y-4">

          {/* Header */}
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              {isMobile
                ? <Truck className="w-4 h-4 shrink-0" />
                : <Home className="w-4 h-4 shrink-0" />}
              <span className="truncate font-medium">{propertyName}</span>
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 leading-tight">
              {ticket.titolo}
            </DialogTitle>
          </DialogHeader>

          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={PRIORITY_COLORS[ticket.priorita] || ''}>
              {ticket.priorita}
            </Badge>
            <Badge variant="outline" className={STATUS_COLORS[ticket.stato] || ''}>
              {ticket.stato?.replace('_', ' ')}
            </Badge>
            {ticket.data_scadenza && (
              <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full border">
                <Calendar className="w-3 h-3" />
                {format(parseISO(ticket.data_scadenza), 'd MMM yyyy', { locale: it })}
              </span>
            )}
            <span className="text-xs text-slate-400">
              Creato {format(new Date(ticket.created_at), 'd MMM', { locale: it })}
            </span>
          </div>

          {/* Descrizione */}
          {ticket.descrizione && (
            <div className="bg-slate-50 rounded-lg p-3 border text-sm text-slate-700 leading-relaxed">
              {ticket.descrizione}
            </div>
          )}

          {/* Assegnati */}
          {assignees.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex items-center gap-1.5 flex-wrap">
                {assignees.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-full px-2.5 py-0.5">
                    <div className="w-4 h-4 rounded-full bg-indigo-200 text-indigo-700 text-[9px] font-bold flex items-center justify-center">
                      {u.initials}
                    </div>
                    <span className="text-xs text-indigo-700 font-medium">{u.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Allegati */}
          {ticket.attachments?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-500">{ticket.attachments.length} allegat{ticket.attachments.length === 1 ? 'o' : 'i'}</span>
              {ticket.attachments.map((path: string, i: number) => (
                <button
                  key={i}
                  onClick={() => openFile(path)}
                  className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2"
                >
                  File {i + 1}
                </button>
              ))}
            </div>
          )}

          {/* Note staff */}
          {ticket.admin_notes && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <StickyNote className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <div className="text-xs text-yellow-900 leading-relaxed break-all">
                <span className="font-semibold block mb-0.5">Note staff:</span>
                {renderTextWithLinks(ticket.admin_notes)}
              </div>
            </div>
          )}

          {/* Ospite */}
          {ticket.bookings?.nome_ospite && (
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className="text-base">👤</span>
              <span>Ospite: <span className="font-medium text-slate-700">{ticket.bookings.nome_ospite}</span></span>
            </div>
          )}

          {/* Footer CTA */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t">
            <Button variant="ghost" className="text-slate-500" onClick={onClose}>
              Annulla
            </Button>
            <Button
              className={isResolved
                ? 'bg-slate-600 hover:bg-slate-700 gap-2'
                : 'bg-blue-600 hover:bg-blue-700 gap-2'}
              onClick={onManage}
            >
              {isResolved
                ? <><Eye className="w-4 h-4" /> Storico</>
                : <><UserCog className="w-4 h-4" /> Gestisci →</>}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
