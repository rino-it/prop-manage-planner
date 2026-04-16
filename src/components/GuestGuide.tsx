import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Wifi, Key, Video, MapPin, FileText, Shield,
  Save, Copy, ExternalLink, Check, Loader2, Home, Trash2, Phone
} from 'lucide-react';

interface GuideFields {
  wifi_ssid: string;
  wifi_password: string;
  keybox_code: string;
  checkin_video_url: string;
  maps_url: string;
  checkin_instructions: string;
  house_rules: string;
  differenziata_info: string;
  contatti_utili: string;
}

const EMPTY_GUIDE: GuideFields = {
  wifi_ssid: '',
  wifi_password: '',
  keybox_code: '',
  checkin_video_url: '',
  maps_url: '',
  checkin_instructions: '',
  house_rules: '',
  differenziata_info: '',
  contatti_utili: '',
};

export default function GuestGuide() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [form, setForm] = useState<GuideFields>(EMPTY_GUIDE);
  const [copied, setCopied] = useState(false);

  const { data: properties, isLoading: loadingProperties } = useQuery({
    queryKey: ['properties-real'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties_real')
        .select('id, nome, citta, via, wifi_ssid, wifi_password, keybox_code, checkin_video_url, maps_url, checkin_instructions, house_rules, differenziata_info, contatti_utili')
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!selectedPropertyId || !properties) {
      setForm(EMPTY_GUIDE);
      return;
    }
    const prop = properties.find((p: any) => p.id === selectedPropertyId);
    if (!prop) return;
    setForm({
      wifi_ssid: prop.wifi_ssid || '',
      wifi_password: prop.wifi_password || '',
      keybox_code: prop.keybox_code || '',
      checkin_video_url: prop.checkin_video_url || '',
      maps_url: prop.maps_url || '',
      checkin_instructions: prop.checkin_instructions || '',
      house_rules: prop.house_rules || '',
      differenziata_info: prop.differenziata_info || '',
      contatti_utili: prop.contatti_utili || '',
    });
  }, [selectedPropertyId, properties]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPropertyId) throw new Error('Nessuna proprieta selezionata');
      const { error } = await supabase
        .from('properties_real')
        .update({
          wifi_ssid: form.wifi_ssid || null,
          wifi_password: form.wifi_password || null,
          keybox_code: form.keybox_code || null,
          checkin_video_url: form.checkin_video_url || null,
          maps_url: form.maps_url || null,
          checkin_instructions: form.checkin_instructions || null,
          house_rules: form.house_rules || null,
          differenziata_info: form.differenziata_info || null,
          contatti_utili: form.contatti_utili || null,
        } as any)
        .eq('id', selectedPropertyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties-real'] });
      toast({ title: 'Guida salvata', description: 'I dati della guida ospiti sono stati aggiornati.' });
    },
    onError: (err: any) => {
      toast({ title: 'Errore', description: err.message || 'Salvataggio fallito', variant: 'destructive' });
    },
  });

  const handleChange = (field: keyof GuideFields, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const selectedProperty = properties?.find((p: any) => p.id === selectedPropertyId);

  const guestPortalUrl = selectedPropertyId
    ? `${window.location.origin}/guest/auto?name=OSPITE&checkin=DATA&checkout=DATA&property=${selectedPropertyId}`
    : null;

  const copyGuideLink = () => {
    if (!guestPortalUrl) return;
    navigator.clipboard.writeText(guestPortalUrl);
    setCopied(true);
    toast({ title: 'Link copiato', description: 'Il link del portale ospite e stato copiato.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const filledFieldsCount = Object.values(form).filter(v => v.trim() !== '').length;
  const totalFields = Object.keys(form).length;

  if (loadingProperties) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Caricamento proprieta...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Guida per gli Ospiti</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Configura le informazioni che gli ospiti vedranno nel portale di check-in.
          </p>
        </div>
        {selectedPropertyId && (
          <Badge variant="outline" className="text-xs self-start">
            {filledFieldsCount}/{totalFields} campi compilati
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="w-4 h-4" />
            Seleziona Proprieta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedPropertyId || ''}
            onValueChange={(val) => setSelectedPropertyId(val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Scegli una proprieta..." />
            </SelectTrigger>
            <SelectContent>
              {properties?.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome} - {p.citta}, {p.via}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!selectedPropertyId && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Home className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">
              Seleziona una proprieta per configurare la guida ospiti.
            </p>
          </CardContent>
        </Card>
      )}

      {selectedPropertyId && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-blue-500" />
                  WiFi
                </CardTitle>
                <CardDescription>Credenziali rete wireless per gli ospiti</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="wifi_ssid">Nome rete (SSID)</Label>
                  <Input
                    id="wifi_ssid"
                    value={form.wifi_ssid}
                    onChange={(e) => handleChange('wifi_ssid', e.target.value)}
                    placeholder="Es. Casa-Vacanza-WiFi"
                  />
                </div>
                <div>
                  <Label htmlFor="wifi_password">Password</Label>
                  <Input
                    id="wifi_password"
                    value={form.wifi_password}
                    onChange={(e) => handleChange('wifi_password', e.target.value)}
                    placeholder="Password WiFi"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-500" />
                  Accesso
                </CardTitle>
                <CardDescription>Codice keybox o serratura smart</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="keybox_code">Codice Keybox</Label>
                  <Input
                    id="keybox_code"
                    value={form.keybox_code}
                    onChange={(e) => handleChange('keybox_code', e.target.value)}
                    placeholder="Es. 1234"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Video className="w-4 h-4 text-red-500" />
                  Video Check-in
                </CardTitle>
                <CardDescription>Link a un video YouTube con istruzioni di arrivo</CardDescription>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="checkin_video_url">URL Video</Label>
                  <Input
                    id="checkin_video_url"
                    value={form.checkin_video_url}
                    onChange={(e) => handleChange('checkin_video_url', e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                  />
                </div>
                {form.checkin_video_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() => window.open(form.checkin_video_url, '_blank')}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" /> Anteprima
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-green-500" />
                  Posizione
                </CardTitle>
                <CardDescription>Link Google Maps per raggiungere la proprieta</CardDescription>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="maps_url">URL Mappa</Label>
                  <Input
                    id="maps_url"
                    value={form.maps_url}
                    onChange={(e) => handleChange('maps_url', e.target.value)}
                    placeholder="https://maps.google.com/..."
                  />
                </div>
                {form.maps_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() => window.open(form.maps_url, '_blank')}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" /> Apri mappa
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-500" />
                Istruzioni Check-in
              </CardTitle>
              <CardDescription>Testo visibile all'ospite con le istruzioni di arrivo</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.checkin_instructions}
                onChange={(e) => handleChange('checkin_instructions', e.target.value)}
                placeholder="Es. Arrivando dall'autostrada, prendere l'uscita... La keybox si trova accanto alla porta principale..."
                rows={4}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-orange-500" />
                Regole della Casa / Regolamento
              </CardTitle>
              <CardDescription>Regole per ospiti brevi e regolamento condominiale per inquilini lungo termine</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.house_rules}
                onChange={(e) => handleChange('house_rules', e.target.value)}
                placeholder="Es. Silenzio dopo le 22:00. Non fumare all'interno. Raccolta differenziata obbligatoria..."
                rows={4}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-green-600" />
                Raccolta Differenziata
              </CardTitle>
              <CardDescription>Istruzioni per la raccolta differenziata (visibile agli inquilini lungo termine)</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.differenziata_info}
                onChange={(e) => handleChange('differenziata_info', e.target.value)}
                placeholder="Es. Lunedì: plastica e vetro (sacchetto giallo). Mercoledì: organico. Venerdì: indifferenziata. Posizionare i sacchi entro le 7:00..."
                rows={4}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-500" />
                Contatti Utili
              </CardTitle>
              <CardDescription>Numeri utili per gli inquilini (idraulico, elettricista, emergenze, condominio...)</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.contatti_utili}
                onChange={(e) => handleChange('contatti_utili', e.target.value)}
                placeholder="Es. Idraulico: Mario Rossi 333-1234567&#10;Elettricista: Giuseppe Bianchi 347-9876543&#10;Emergenze gas: 800-900860&#10;Amministratore condominio: 02-12345678"
                rows={4}
              />
            </CardContent>
          </Card>

          <Separator />

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salva Guida
            </Button>

            {guestPortalUrl && (
              <Button variant="outline" onClick={copyGuideLink}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copiato' : 'Copia link portale ospite'}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
