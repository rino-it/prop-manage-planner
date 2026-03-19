import React, { useState, useEffect } from 'react';
import { usePaymentSettings, useSavePaymentSettings, type PaymentSettings } from '@/hooks/usePaymentSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronsUpDown, RefreshCw, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PaymentSettingsProps {
  propertyId: string;
}

const DEFAULT_SETTINGS: Partial<PaymentSettings> = {
  stripe_account_id: null,
  stripe_configured: false,
  caparra_percentage: 20,
  caparra_due_days: 0,
  saldo_due_days_before: 7,
  cauzione_amount: 200,
  cauzione_preauth_days_before: 7,
  cauzione_release_days_after: 30,
  tassa_soggiorno_per_night: 2.5,
  tassa_soggiorno_per_person: false,
  checkin_email_days_before: 3,
  reminder_days_before: 7,
  brand_color: '#1a1a1a',
  email_from_name: null,
  email_reply_to: null,
  ical_url: null
};

export default function PaymentSettings({ propertyId }: PaymentSettingsProps) {
  const { data: settings, isLoading } = usePaymentSettings(propertyId);
  const { mutate: saveSettings, isPending } = useSavePaymentSettings();
  const { toast } = useToast();

  const [formData, setFormData] = useState<Partial<PaymentSettings>>(DEFAULT_SETTINGS);
  const [openSections, setOpenSections] = useState({
    stripe: true,
    payments: true,
    email: false,
    ical: false
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    } else {
      setFormData(DEFAULT_SETTINGS);
    }
  }, [settings]);

  const handleChange = (field: keyof PaymentSettings, value: string | number | boolean | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    saveSettings(
      { ...formData, property_id: propertyId } as Partial<PaymentSettings> & { property_id: string }
    );
  };

  const handleSyncCalendar = async () => {
    if (!formData.ical_url) {
      toast({ title: 'Errore', description: 'URL iCal non configurato', variant: 'destructive' });
      return;
    }
    toast({ title: 'Sincronizzazione', description: 'Sincronizzazione del calendario in corso...' });
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Caricamento impostazioni...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* STRIPE SECTION */}
      <Card>
        <Collapsible open={openSections.stripe} onOpenChange={() => toggleSection('stripe')}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Stripe</CardTitle>
                <div className="flex items-center gap-2">
                  {formData.stripe_configured && (
                    <Badge variant="default">Configurato</Badge>
                  )}
                  <ChevronsUpDown className="h-5 w-5 text-gray-500" />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="stripe_account_id">ID Account Stripe</Label>
                <Input
                  id="stripe_account_id"
                  value={formData.stripe_account_id || ''}
                  onChange={(e) => handleChange('stripe_account_id', e.target.value || null)}
                  placeholder="acct_..."
                  className="mt-1"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="stripe_configured"
                  checked={formData.stripe_configured || false}
                  onCheckedChange={(checked) => handleChange('stripe_configured', checked)}
                />
                <Label htmlFor="stripe_configured">Stripe configurato</Label>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* PAYMENTS SECTION */}
      <Card>
        <Collapsible open={openSections.payments} onOpenChange={() => toggleSection('payments')}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Pagamenti</CardTitle>
                <ChevronsUpDown className="h-5 w-5 text-gray-500" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="caparra_percentage">Caparra (%)</Label>
                  <Input
                    id="caparra_percentage"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.caparra_percentage || 0}
                    onChange={(e) => handleChange('caparra_percentage', parseFloat(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="caparra_due_days">Caparra scadenza (giorni)</Label>
                  <Input
                    id="caparra_due_days"
                    type="number"
                    min="0"
                    value={formData.caparra_due_days || 0}
                    onChange={(e) => handleChange('caparra_due_days', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="saldo_due_days_before">Saldo scadenza (giorni prima)</Label>
                  <Input
                    id="saldo_due_days_before"
                    type="number"
                    min="0"
                    value={formData.saldo_due_days_before || 0}
                    onChange={(e) => handleChange('saldo_due_days_before', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="cauzione_amount">Cauzione (EUR)</Label>
                  <Input
                    id="cauzione_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cauzione_amount || 0}
                    onChange={(e) => handleChange('cauzione_amount', parseFloat(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cauzione_preauth_days_before">Pre-auth cauzione (giorni prima)</Label>
                  <Input
                    id="cauzione_preauth_days_before"
                    type="number"
                    min="0"
                    value={formData.cauzione_preauth_days_before || 0}
                    onChange={(e) => handleChange('cauzione_preauth_days_before', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="cauzione_release_days_after">Rilascio cauzione (giorni dopo)</Label>
                  <Input
                    id="cauzione_release_days_after"
                    type="number"
                    min="0"
                    value={formData.cauzione_release_days_after || 0}
                    onChange={(e) => handleChange('cauzione_release_days_after', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tassa_soggiorno_per_night">Tassa soggiorno per notte (EUR)</Label>
                  <Input
                    id="tassa_soggiorno_per_night"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.tassa_soggiorno_per_night || 0}
                    onChange={(e) => handleChange('tassa_soggiorno_per_night', parseFloat(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-end">
                  <div className="flex items-center space-x-2 w-full">
                    <Switch
                      id="tassa_soggiorno_per_person"
                      checked={formData.tassa_soggiorno_per_person || false}
                      onCheckedChange={(checked) => handleChange('tassa_soggiorno_per_person', checked)}
                    />
                    <Label htmlFor="tassa_soggiorno_per_person">Per persona</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* EMAIL SECTION */}
      <Card>
        <Collapsible open={openSections.email} onOpenChange={() => toggleSection('email')}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Email e Branding</CardTitle>
                <ChevronsUpDown className="h-5 w-5 text-gray-500" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="brand_logo_url">URL Logo</Label>
                <Input
                  id="brand_logo_url"
                  value={formData.brand_logo_url || ''}
                  onChange={(e) => handleChange('brand_logo_url', e.target.value || null)}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="brand_color">Colore Brand</Label>
                <div className="flex gap-2 mt-1">
                  <input
                    id="brand_color"
                    type="color"
                    value={formData.brand_color || '#1a1a1a'}
                    onChange={(e) => handleChange('brand_color', e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={formData.brand_color || ''}
                    onChange={(e) => handleChange('brand_color', e.target.value)}
                    placeholder="#1a1a1a"
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email_from_name">Da (nome mittente)</Label>
                <Input
                  id="email_from_name"
                  value={formData.email_from_name || ''}
                  onChange={(e) => handleChange('email_from_name', e.target.value || null)}
                  placeholder="es. Proprietario"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="email_reply_to">Reply-To</Label>
                <Input
                  id="email_reply_to"
                  type="email"
                  value={formData.email_reply_to || ''}
                  onChange={(e) => handleChange('email_reply_to', e.target.value || null)}
                  placeholder="proprietario@example.com"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="checkin_email_days_before">Email check-in (giorni prima)</Label>
                  <Input
                    id="checkin_email_days_before"
                    type="number"
                    min="0"
                    value={formData.checkin_email_days_before || 0}
                    onChange={(e) => handleChange('checkin_email_days_before', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="reminder_days_before">Promemoria pagamento (giorni prima)</Label>
                  <Input
                    id="reminder_days_before"
                    type="number"
                    min="0"
                    value={formData.reminder_days_before || 0}
                    onChange={(e) => handleChange('reminder_days_before', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* ICAL SECTION */}
      <Card>
        <Collapsible open={openSections.ical} onOpenChange={() => toggleSection('ical')}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">iCal</CardTitle>
                <ChevronsUpDown className="h-5 w-5 text-gray-500" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ical_url">URL iCal</Label>
                <Input
                  id="ical_url"
                  value={formData.ical_url || ''}
                  onChange={(e) => handleChange('ical_url', e.target.value || null)}
                  placeholder="https://calendar.example.com/..."
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleSyncCalendar}
                variant="outline"
                className="w-full"
                disabled={!formData.ical_url}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizza Ora
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* SAVE BUTTON */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={isPending}
          className="flex-1"
        >
          <Save className="h-4 w-4 mr-2" />
          {isPending ? 'Salvataggio...' : 'Salva impostazioni'}
        </Button>
      </div>
    </div>
  );
}
