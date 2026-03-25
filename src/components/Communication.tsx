import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMessages, NewMessage } from '@/hooks/useMessages';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Send, MessageCircle, Mail, Phone, FileText,
  Loader2, CheckCircle, Home, User, Zap
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';

interface CommunicationTemplate {
  key: string;
  label: string;
  category: 'check-in' | 'pagamento' | 'benvenuto' | 'manutenzione';
  channel: 'whatsapp' | 'email' | 'internal';
  content: string;
}

const templates: CommunicationTemplate[] = [
  {
    key: 'welcome',
    label: 'Benvenuto nuovo inquilino',
    category: 'benvenuto',
    channel: 'internal',
    content: `Benvenuto! Siamo lieti di averti come inquilino. Ecco le informazioni principali per il tuo soggiorno:\n\n- Portale inquilino: accedi tramite il link che hai ricevuto\n- Per qualsiasi problema tecnico, apri un ticket dal portale\n- I pagamenti sono gestibili direttamente online\n\nBuon soggiorno!`,
  },
  {
    key: 'checkin-reminder',
    label: 'Promemoria check-in',
    category: 'check-in',
    channel: 'whatsapp',
    content: `Promemoria: il tuo check-in e' previsto per domani. Ricorda di portare un documento di identita' valido. L'orario di ingresso e' dalle 15:00. Per qualsiasi necessita', contattaci.`,
  },
  {
    key: 'checkin-instructions',
    label: 'Istruzioni check-in',
    category: 'check-in',
    channel: 'email',
    content: `Ecco le istruzioni per il check-in:\n\n1. Presentati all'indirizzo indicato nella prenotazione\n2. Porta con te un documento di identita' valido\n3. Ritira le chiavi alla reception / cassetta di sicurezza\n4. Accedi al portale ospite per Wi-Fi e servizi aggiuntivi\n\nA presto!`,
  },
  {
    key: 'payment-reminder',
    label: 'Promemoria pagamento',
    category: 'pagamento',
    channel: 'internal',
    content: `Ti ricordiamo che la prossima scadenza di pagamento e' in arrivo. Puoi effettuare il pagamento dal portale inquilino o tramite bonifico. In caso di difficolta', contattaci per trovare una soluzione.`,
  },
  {
    key: 'payment-overdue',
    label: 'Pagamento scaduto',
    category: 'pagamento',
    channel: 'email',
    content: `Risulta un pagamento scaduto sul tuo conto. Ti chiediamo di provvedere al saldo il prima possibile per evitare ulteriori ritardi. Accedi al portale per i dettagli o contattaci direttamente.`,
  },
  {
    key: 'maintenance-scheduled',
    label: 'Manutenzione programmata',
    category: 'manutenzione',
    channel: 'internal',
    content: `Ti informiamo che e' stata programmata una manutenzione presso la tua unita'. Il nostro tecnico interverra' nella data concordata. Per qualsiasi esigenza, apri un ticket dal portale.`,
  },
  {
    key: 'maintenance-completed',
    label: 'Manutenzione completata',
    category: 'manutenzione',
    channel: 'internal',
    content: `L'intervento di manutenzione richiesto e' stato completato. Se riscontri ancora problemi, apri un nuovo ticket dal portale. Grazie per la pazienza.`,
  },
];

const categoryLabels: Record<string, string> = {
  'check-in': 'Check-in',
  pagamento: 'Pagamento',
  benvenuto: 'Benvenuto',
  manutenzione: 'Manutenzione',
};

const categoryIcons: Record<string, React.ElementType> = {
  'check-in': Home,
  pagamento: FileText,
  benvenuto: User,
  manutenzione: Zap,
};

export default function Communication() {
  const { sendMessage } = useMessages();
  const [selectedTemplate, setSelectedTemplate] = useState<CommunicationTemplate | null>(null);
  const [content, setContent] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'email' | 'internal'>('internal');
  const [bookingId, setBookingId] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [sent, setSent] = useState(false);

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['bookings-for-communication'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, nome_ospite, properties_real(nome)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filteredTemplates = useMemo(() => {
    if (activeCategory === 'all') return templates;
    return templates.filter((t) => t.category === activeCategory);
  }, [activeCategory]);

  const applyTemplate = (template: CommunicationTemplate) => {
    setSelectedTemplate(template);
    setContent(template.content);
    setChannel(template.channel);
    setSent(false);
  };

  const handleSend = async () => {
    if (!content.trim()) return;

    const msg: NewMessage = {
      content: content.trim(),
      channel,
      sender_type: 'host',
      booking_id: bookingId || null,
      property_id: null,
      template_key: selectedTemplate?.key || null,
    };

    await sendMessage.mutateAsync(msg);
    setSent(true);
    setTimeout(() => {
      setContent('');
      setSelectedTemplate(null);
      setBookingId('');
      setSent(false);
    }, 2000);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Comunicazione" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold">Template</CardTitle>
            <CardDescription className="text-xs">
              Modelli predefiniti per comunicazioni rapide
            </CardDescription>
          </CardHeader>

          <div className="px-4 pb-2">
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="w-full grid grid-cols-5">
                <TabsTrigger value="all" className="text-xs">Tutti</TabsTrigger>
                <TabsTrigger value="check-in" className="text-xs">Check-in</TabsTrigger>
                <TabsTrigger value="pagamento" className="text-xs">Pag.</TabsTrigger>
                <TabsTrigger value="benvenuto" className="text-xs">Ben.</TabsTrigger>
                <TabsTrigger value="manutenzione" className="text-xs">Man.</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="px-2 pb-3 space-y-1 max-h-[calc(100vh-400px)] overflow-y-auto">
            {filteredTemplates.map((t) => {
              const CategoryIcon = categoryIcons[t.category] || FileText;
              const isActive = selectedTemplate?.key === t.key;

              return (
                <button
                  key={t.key}
                  onClick={() => applyTemplate(t)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-md transition-colors',
                    isActive
                      ? 'bg-primary/8 border border-primary/20'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <CategoryIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium">{t.label}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 ml-6">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {categoryLabels[t.category]}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {t.channel === 'whatsapp' ? 'WhatsApp' : t.channel === 'email' ? 'Email' : 'Interno'}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm font-semibold">
              {selectedTemplate ? `Componi: ${selectedTemplate.label}` : 'Componi messaggio'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Destinatario (prenotazione)</Label>
                <Select value={bookingId} onValueChange={setBookingId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona prenotazione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bookings.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.nome_ospite} {b.properties_real?.nome ? `- ${b.properties_real.nome}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Canale</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">
                      <span className="flex items-center gap-2">
                        <MessageCircle className="h-3.5 w-3.5" /> Interno
                      </span>
                    </SelectItem>
                    <SelectItem value="whatsapp">
                      <span className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5" /> WhatsApp
                      </span>
                    </SelectItem>
                    <SelectItem value="email">
                      <span className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" /> Email
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Messaggio</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                placeholder="Scrivi il messaggio o seleziona un template..."
                className="resize-none text-sm"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {content.length > 0 && `${content.length} caratteri`}
              </div>
              <div className="flex items-center gap-2">
                {selectedTemplate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedTemplate(null);
                      setContent('');
                    }}
                  >
                    Pulisci
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!content.trim() || sendMessage.isPending || sent}
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : sent ? (
                    <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  {sent ? 'Inviato' : 'Invia'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
