import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMessages, NewMessage } from '@/hooks/useMessages';
import { multilingualTemplates, MultilingualTemplate } from '@/data/communication-templates-multilang';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Send, MessageCircle, Mail, Phone, FileText,
  Loader2, CheckCircle, Home, User, Zap, Globe
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';

type Language = 'it' | 'en' | 'fr' | 'de';

const categoryLabels: Record<string, string> = {
  'check-in': 'Check-in',
  'check-out': 'Check-out',
  benvenuto: 'Benvenuto',
  regole: 'Regole',
  wifi: 'WiFi',
  emergenza: 'Emergenza',
  feedback: 'Feedback',
};

const categoryIcons: Record<string, React.ElementType> = {
  'check-in': Home,
  'check-out': Home,
  benvenuto: User,
  regole: FileText,
  wifi: Zap,
  emergenza: Phone,
  feedback: MessageCircle,
};

const languageLabels: Record<Language, string> = {
  it: 'Italiano',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
};

// Property-specific placeholder data (for demo - can be extended to fetch from DB)
const propertyData: Record<string, Record<string, string>> = {
  '472bb155-27b1-4edd-8fd9-146ea0d24885': { // Villa Sardegna
    PROPERTY_NAME: 'Villa Sardegna',
    PROPERTY_ADDRESS: 'Via Lisambuli 33h',
    EMERGENCY_PHONE: '3917924372',
    EMERGENCY_EMAIL: 'info@edvcostruzioni.com',
    ACCESS_METHOD: 'nella cassetta di sicurezza',
    DOOR_CODE: '1234',
    WIFI_SSID: 'Villa-Sardegna',
    WIFI_PASSWORD: 'welcome123',
    POWER_LOCATION: 'armadio cucina',
    WATER_LOCATION: 'giardino dietro casa',
    HEATING_LOCATION: 'bagno principale',
    TV_INFO: 'Smart TV con Netflix',
    MUSIC_INFO: 'Bluetooth speaker',
    KEY_RETURN_METHOD: 'nella cassetta di sicurezza',
  },
  'b0b7311a-31cc-4230-a8c4-02a14ee4932a': { // Vertova Trilocale
    PROPERTY_NAME: 'Vertova Trilocale con Giardino',
    PROPERTY_ADDRESS: 'Via Cadelora 6, Vertova',
    EMERGENCY_PHONE: '3917924372',
    EMERGENCY_EMAIL: 'info@edvcostruzioni.com',
    ACCESS_METHOD: 'al citofono con codice',
    DOOR_CODE: '5678',
    WIFI_SSID: 'Vertova-Trilocale',
    WIFI_PASSWORD: 'welcome456',
    POWER_LOCATION: 'corridoio principale',
    WATER_LOCATION: 'sotto il lavandino cucina',
    HEATING_LOCATION: 'ripostiglio',
    TV_INFO: 'TV 55 pollici',
    MUSIC_INFO: 'Sistema audio integrato',
    KEY_RETURN_METHOD: 'al citofono',
  },
  'ddb3c520-f064-4cc7-8e42-9e000efd61b4': { // Passo Mendola
    PROPERTY_NAME: 'Villa Imperiale Passo Mendola',
    PROPERTY_ADDRESS: 'Passo Mendola, Ruffrè',
    EMERGENCY_PHONE: '3917924372',
    EMERGENCY_EMAIL: 'info@edvcostruzioni.com',
    ACCESS_METHOD: 'nel borsellino magnetico',
    DOOR_CODE: '9012',
    WIFI_SSID: 'PassoMendola-Villa',
    WIFI_PASSWORD: 'welcome789',
    POWER_LOCATION: 'garage',
    WATER_LOCATION: 'taverna',
    HEATING_LOCATION: 'cantina',
    TV_INFO: 'Schermo principale in salotto',
    MUSIC_INFO: 'Sistema home audio',
    KEY_RETURN_METHOD: 'nel borsellino magnetico',
  },
};

// Function to replace placeholders with property data
const replacePlaceholders = (text: string, propertyId?: string): string => {
  const data = propertyId ? propertyData[propertyId] : {};
  let result = text;
  
  Object.entries(data).forEach(([key, value]) => {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });
  
  // Replace any unreplaced placeholders with placeholder text
  result = result.replace(/{{[^}]+}}/g, '[PLACEHOLDER]');
  
  return result;
};

export default function Communication() {
  const { sendMessage } = useMessages();
  const [selectedTemplate, setSelectedTemplate] = useState<MultilingualTemplate | null>(null);
  const [content, setContent] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'email' | 'internal'>('internal');
  const [bookingId, setBookingId] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [language, setLanguage] = useState<Language>('it');
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
    if (activeCategory === 'all') return multilingualTemplates;
    return multilingualTemplates.filter((t) => t.category === activeCategory);
  }, [activeCategory]);

  const applyTemplate = (template: MultilingualTemplate) => {
    setSelectedTemplate(template);
    const templateContent = template.languages[language];
    const processedContent = replacePlaceholders(templateContent, bookingId);
    setContent(processedContent);
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

          <div className="px-4 pb-4 space-y-3">
            <div>
              <Label className="text-xs font-medium mb-2 block">Lingua</Label>
              <Tabs value={language} onValueChange={(v) => {
                setLanguage(v as Language);
                // Update content with new language if template selected
                if (selectedTemplate) {
                  const newContent = selectedTemplate.languages[v as Language];
                  const processedContent = replacePlaceholders(newContent, bookingId);
                  setContent(processedContent);
                }
              }}>
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="it" className="text-xs">IT</TabsTrigger>
                  <TabsTrigger value="en" className="text-xs">EN</TabsTrigger>
                  <TabsTrigger value="fr" className="text-xs">FR</TabsTrigger>
                  <TabsTrigger value="de" className="text-xs">DE</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div>
              <Label className="text-xs font-medium mb-2 block">Categoria</Label>
              <Tabs value={activeCategory} onValueChange={setActiveCategory}>
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="all" className="text-xs">Tutti</TabsTrigger>
                  <TabsTrigger value="benvenuto" className="text-xs">Ben.</TabsTrigger>
                  <TabsTrigger value="check-in" className="text-xs">In</TabsTrigger>
                  <TabsTrigger value="check-out" className="text-xs">Out</TabsTrigger>
                </TabsList>
              </Tabs>
              <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mt-2">
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="regole" className="text-xs">Regole</TabsTrigger>
                  <TabsTrigger value="wifi" className="text-xs">WiFi</TabsTrigger>
                  <TabsTrigger value="emergenza" className="text-xs">SOS</TabsTrigger>
                  <TabsTrigger value="feedback" className="text-xs">Feedback</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
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
                  <div className="flex items-center gap-1 mt-1 ml-6 flex-wrap">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {categoryLabels[t.category]}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {t.channel === 'whatsapp' ? 'WhatsApp' : t.channel === 'email' ? 'Email' : 'Interno'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50">
                      {languageLabels[language]}
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
