import React, { useState, useMemo } from 'react';
import {
  DollarSign, Plus, Pencil, Trash2, ChevronLeft, ChevronRight,
  TrendingUp, Calendar, AlertCircle, Loader2, Save, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { usePropertiesReal } from '@/hooks/useProperties';
import {
  usePricingRules,
  useCreatePricingRule,
  useUpdatePricingRule,
  useDeletePricingRule,
  calculateNightPrice,
  type PricingRule,
  type SeasonAdjustment,
  type PricingRuleInsert,
  type PricingRuleUpdate,
} from '@/hooks/usePricing';
import { cn } from '@/lib/utils';

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

const DEFAULT_SEASONS: SeasonAdjustment[] = [
  { name: 'Alta Stagione', start_month: 6, start_day: 15, end_month: 9, end_day: 15, adjustment_percent: 30, adjustment_fixed: 0 },
  { name: 'Bassa Stagione', start_month: 11, start_day: 1, end_month: 3, end_day: 15, adjustment_percent: -20, adjustment_fixed: 0 },
  { name: 'Festivita', start_month: 12, start_day: 20, end_month: 1, end_day: 6, adjustment_percent: 50, adjustment_fixed: 0 },
];

interface PropertyOption {
  id: string;
  nome: string;
  indirizzo: string | null;
  citta: string | null;
}

export default function Pricing() {
  const { data: properties, isLoading: propertiesLoading } = usePropertiesReal();
  const { data: pricingRules, isLoading: rulesLoading } = usePricingRules();
  const createRule = useCreatePricingRule();
  const updateRule = useUpdatePricingRule();
  const deleteRule = useDeletePricingRule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const isLoading = propertiesLoading || rulesLoading;

  const propertiesWithPricing = useMemo(() => {
    if (!properties || !pricingRules) return [];
    return properties.map(p => ({
      ...p,
      pricingRule: pricingRules.find(r => r.property_id === p.id) || null,
    }));
  }, [properties, pricingRules]);

  const propertiesWithoutPricing = useMemo(() => {
    if (!properties || !pricingRules) return [];
    const ruledIds = new Set(pricingRules.map(r => r.property_id));
    return properties.filter(p => !ruledIds.has(p.id));
  }, [properties, pricingRules]);

  const handleOpenCreate = (propertyId?: string) => {
    setEditingRule(null);
    setSelectedPropertyId(propertyId || null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (rule: PricingRule) => {
    setEditingRule(rule);
    setSelectedPropertyId(rule.property_id);
    setDialogOpen(true);
  };

  const handleDeleteRequest = (id: string) => {
    setDeletingRuleId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deletingRuleId) {
      deleteRule.mutate(deletingRuleId);
    }
    setDeleteDialogOpen(false);
    setDeletingRuleId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prezzi</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestione prezzi per notte e regole stagionali
          </p>
        </div>
        {propertiesWithoutPricing.length > 0 && (
          <Button onClick={() => handleOpenCreate()} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Configura Prezzi
          </Button>
        )}
      </div>

      {(!pricingRules || pricingRules.length === 0) ? (
        <EmptyState
          properties={properties || []}
          onCreateClick={handleOpenCreate}
        />
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Panoramica</TabsTrigger>
            <TabsTrigger value="calendar">Calendario Prezzi</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {propertiesWithPricing.map(prop => (
                <PropertyPricingCard
                  key={prop.id}
                  property={prop}
                  rule={prop.pricingRule}
                  onEdit={handleOpenEdit}
                  onDelete={handleDeleteRequest}
                  onCreate={() => handleOpenCreate(prop.id)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            {pricingRules.map(rule => {
              const prop = properties?.find(p => p.id === rule.property_id);
              if (!prop) return null;
              return (
                <PriceCalendarPreview
                  key={rule.id}
                  rule={rule as PricingRule}
                  propertyName={prop.nome}
                />
              );
            })}
          </TabsContent>
        </Tabs>
      )}

      <PricingRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingRule={editingRule}
        selectedPropertyId={selectedPropertyId}
        properties={propertiesWithoutPricing}
        onSave={(data) => {
          if (editingRule) {
            updateRule.mutate({ id: editingRule.id, updates: data as PricingRuleUpdate });
          } else {
            createRule.mutate(data as PricingRuleInsert);
          }
          setDialogOpen(false);
        }}
        isSaving={createRule.isPending || updateRule.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la regola di pricing?</AlertDialogTitle>
            <AlertDialogDescription>
              La regola verra rimossa definitivamente. La proprieta tornera senza prezzi configurati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({
  properties,
  onCreateClick,
}: {
  properties: PropertyOption[];
  onCreateClick: (propertyId?: string) => void;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <DollarSign className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-1">Nessun prezzo configurato</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
          Configura i prezzi per notte delle tue proprieta. Puoi impostare prezzi base, aggiustamenti stagionali e supplementi weekend.
        </p>
        {properties.length > 0 ? (
          <Button onClick={() => onCreateClick()}>
            <Plus className="h-4 w-4 mr-1.5" />
            Configura Prezzi
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            Aggiungi prima una proprieta immobiliare
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PropertyPricingCard({
  property,
  rule,
  onEdit,
  onDelete,
  onCreate,
}: {
  property: PropertyOption & { pricingRule: PricingRule | null };
  rule: PricingRule | null;
  onEdit: (rule: PricingRule) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}) {
  const todayPrice = rule ? calculateNightPrice(rule, new Date()) : null;

  if (!rule) {
    return (
      <Card className="border-dashed opacity-70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{property.nome}</CardTitle>
          <CardDescription>{property.indirizzo || property.citta || 'Nessun indirizzo'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" className="w-full" onClick={onCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Configura Prezzi
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{property.nome}</CardTitle>
            <CardDescription>{property.indirizzo || property.citta || 'Nessun indirizzo'}</CardDescription>
          </div>
          <Badge variant={rule.strategy === 'dynamic' ? 'default' : 'secondary'}>
            {rule.strategy === 'dynamic' ? 'Dinamico' : 'Manuale'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Base</div>
            <div className="text-lg font-bold">{formatEuro(rule.base_price)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Min</div>
            <div className="text-lg font-semibold text-muted-foreground">
              {rule.min_price !== null ? formatEuro(rule.min_price) : '-'}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Max</div>
            <div className="text-lg font-semibold text-muted-foreground">
              {rule.max_price !== null ? formatEuro(rule.max_price) : '-'}
            </div>
          </div>
        </div>

        {todayPrice !== null && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-50 border border-green-200">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700">
              Prezzo stanotte: <span className="font-bold">{formatEuro(todayPrice)}</span>
            </span>
          </div>
        )}

        {rule.season_adjustments && rule.season_adjustments.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Stagioni</div>
            <div className="flex flex-wrap gap-1.5">
              {rule.season_adjustments.map((s, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {s.name}: {s.adjustment_percent > 0 ? '+' : ''}{s.adjustment_percent}%
                </Badge>
              ))}
            </div>
          </div>
        )}

        {rule.weekend_adjustment !== 0 && (
          <div className="text-xs text-muted-foreground">
            Weekend: {rule.weekend_adjustment > 0 ? '+' : ''}{rule.weekend_adjustment}%
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(rule)}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Modifica
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(rule.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PriceCalendarPreview({
  rule,
  propertyName,
}: {
  rule: PricingRule;
  propertyName: string;
}) {
  const [monthOffset, setMonthOffset] = useState(0);

  const currentDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7;
    const days: { date: Date; price: number; inMonth: boolean }[] = [];

    for (let i = 0; i < startDow; i++) {
      const d = new Date(year, month, -startDow + i + 1);
      days.push({ date: d, price: calculateNightPrice(rule, d), inMonth: false });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      days.push({ date, price: calculateNightPrice(rule, date), inMonth: true });
    }

    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month + 1, i);
        days.push({ date: d, price: calculateNightPrice(rule, d), inMonth: false });
      }
    }

    return days;
  }, [rule, year, month]);

  const priceRange = useMemo(() => {
    const inMonthPrices = calendarDays.filter(d => d.inMonth).map(d => d.price);
    return { min: Math.min(...inMonthPrices), max: Math.max(...inMonthPrices) };
  }, [calendarDays]);

  function priceColor(price: number): string {
    if (priceRange.max === priceRange.min) return 'bg-blue-50 text-blue-700';
    const ratio = (price - priceRange.min) / (priceRange.max - priceRange.min);
    if (ratio < 0.33) return 'bg-green-50 text-green-700';
    if (ratio < 0.66) return 'bg-amber-50 text-amber-700';
    return 'bg-red-50 text-red-700';
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {propertyName}
            </CardTitle>
            <CardDescription>
              {MONTH_NAMES[month]} {year} - Range: {formatEuro(priceRange.min)} - {formatEuro(priceRange.max)}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonthOffset(o => o - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setMonthOffset(0)}>
              Oggi
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonthOffset(o => o + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => (
            <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
          ))}
          {calendarDays.map((day, i) => (
            <div
              key={i}
              className={cn(
                'rounded-md p-1.5 text-center transition-colors',
                day.inMonth ? priceColor(day.price) : 'bg-transparent text-muted-foreground/30'
              )}
            >
              <div className="text-[10px] leading-none mb-0.5">{day.date.getDate()}</div>
              <div className={cn('text-xs font-semibold leading-none', !day.inMonth && 'opacity-30')}>
                {formatEuroCompact(day.price)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-green-100 border border-green-200" />
            <span className="text-[10px] text-muted-foreground">Bassa</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-amber-100 border border-amber-200" />
            <span className="text-[10px] text-muted-foreground">Media</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-red-100 border border-red-200" />
            <span className="text-[10px] text-muted-foreground">Alta</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface PricingRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule: PricingRule | null;
  selectedPropertyId: string | null;
  properties: PropertyOption[];
  onSave: (data: PricingRuleInsert | PricingRuleUpdate) => void;
  isSaving: boolean;
}

function PricingRuleDialog({
  open,
  onOpenChange,
  editingRule,
  selectedPropertyId,
  properties,
  onSave,
  isSaving,
}: PricingRuleDialogProps) {
  const [propertyId, setPropertyId] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [weekendAdj, setWeekendAdj] = useState('');
  const [strategy, setStrategy] = useState<'manual' | 'dynamic'>('manual');
  const [seasons, setSeasons] = useState<SeasonAdjustment[]>([]);
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (open) {
      if (editingRule) {
        setPropertyId(editingRule.property_id);
        setBasePrice(String(editingRule.base_price));
        setMinPrice(editingRule.min_price !== null ? String(editingRule.min_price) : '');
        setMaxPrice(editingRule.max_price !== null ? String(editingRule.max_price) : '');
        setWeekendAdj(String(editingRule.weekend_adjustment || ''));
        setStrategy(editingRule.strategy);
        setSeasons(editingRule.season_adjustments || []);
        setNotes(editingRule.notes || '');
      } else {
        setPropertyId(selectedPropertyId || '');
        setBasePrice('');
        setMinPrice('');
        setMaxPrice('');
        setWeekendAdj('');
        setStrategy('manual');
        setSeasons([]);
        setNotes('');
      }
    }
  }, [open, editingRule, selectedPropertyId]);

  const handleAddDefaultSeasons = () => {
    setSeasons(DEFAULT_SEASONS);
  };

  const handleAddSeason = () => {
    setSeasons([
      ...seasons,
      { name: '', start_month: 1, start_day: 1, end_month: 1, end_day: 31, adjustment_percent: 0, adjustment_fixed: 0 },
    ]);
  };

  const handleRemoveSeason = (index: number) => {
    setSeasons(seasons.filter((_, i) => i !== index));
  };

  const handleSeasonChange = (index: number, field: keyof SeasonAdjustment, value: string | number) => {
    setSeasons(seasons.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const handleSubmit = () => {
    const base = parseFloat(basePrice);
    if (isNaN(base) || base < 0) return;

    const data: PricingRuleInsert | PricingRuleUpdate = {
      base_price: base,
      min_price: minPrice ? parseFloat(minPrice) : null,
      max_price: maxPrice ? parseFloat(maxPrice) : null,
      strategy,
      season_adjustments: seasons.filter(s => s.name.trim() !== ''),
      weekend_adjustment: weekendAdj ? parseFloat(weekendAdj) : 0,
      notes: notes.trim() || null,
    };

    if (!editingRule) {
      (data as PricingRuleInsert).property_id = propertyId;
    }

    onSave(data);
  };

  const isValid = (() => {
    const base = parseFloat(basePrice);
    if (isNaN(base) || base < 0) return false;
    if (!editingRule && !propertyId) return false;
    const min = minPrice ? parseFloat(minPrice) : null;
    const max = maxPrice ? parseFloat(maxPrice) : null;
    if (min !== null && max !== null && min > max) return false;
    if (min !== null && base < min) return false;
    if (max !== null && base > max) return false;
    return true;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingRule ? 'Modifica Regola Pricing' : 'Nuova Regola Pricing'}</DialogTitle>
          <DialogDescription>
            Configura il prezzo base, i limiti e gli aggiustamenti stagionali
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {!editingRule && (
            <div className="space-y-2">
              <Label>Proprieta</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona proprieta" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Prezzo Base / notte</Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={basePrice}
                  onChange={e => setBasePrice(e.target.value)}
                  className="pl-8"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prezzo Minimo</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={minPrice}
                onChange={e => setMinPrice(e.target.value)}
                placeholder="Opzionale"
              />
            </div>
            <div className="space-y-2">
              <Label>Prezzo Massimo</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={maxPrice}
                onChange={e => setMaxPrice(e.target.value)}
                placeholder="Opzionale"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Supplemento Weekend (%)</Label>
              <Input
                type="number"
                step="1"
                value={weekendAdj}
                onChange={e => setWeekendAdj(e.target.value)}
                placeholder="es. 15"
              />
              <p className="text-[11px] text-muted-foreground">Applicato a venerdi e sabato notte</p>
            </div>
            <div className="space-y-2">
              <Label>Strategia</Label>
              <Select value={strategy} onValueChange={(v) => setStrategy(v as 'manual' | 'dynamic')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manuale</SelectItem>
                  <SelectItem value="dynamic">Dinamico</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {strategy === 'dynamic' ? 'I prezzi saranno suggeriti algoritmicamente' : 'Prezzi gestiti manualmente'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Aggiustamenti Stagionali</Label>
              <div className="flex gap-2">
                {seasons.length === 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleAddDefaultSeasons}>
                    Usa template
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleAddSeason}>
                  <Plus className="h-3 w-3 mr-1" />
                  Aggiungi
                </Button>
              </div>
            </div>

            {seasons.length === 0 && (
              <p className="text-sm text-muted-foreground">Nessun aggiustamento stagionale configurato</p>
            )}

            {seasons.map((season, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Input
                    value={season.name}
                    onChange={e => handleSeasonChange(i, 'name', e.target.value)}
                    placeholder="Nome stagione"
                    className="h-8 text-sm max-w-[200px]"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveSeason(i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <div>
                    <Label className="text-[10px]">Mese inizio</Label>
                    <Select
                      value={String(season.start_month)}
                      onValueChange={v => handleSeasonChange(i, 'start_month', parseInt(v))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_NAMES.map((m, mi) => (
                          <SelectItem key={mi} value={String(mi + 1)}>{m.slice(0, 3)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Giorno</Label>
                    <Input
                      type="number" min="1" max="31"
                      value={season.start_day}
                      onChange={e => handleSeasonChange(i, 'start_day', parseInt(e.target.value) || 1)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Mese fine</Label>
                    <Select
                      value={String(season.end_month)}
                      onValueChange={v => handleSeasonChange(i, 'end_month', parseInt(v))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_NAMES.map((m, mi) => (
                          <SelectItem key={mi} value={String(mi + 1)}>{m.slice(0, 3)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Giorno</Label>
                    <Input
                      type="number" min="1" max="31"
                      value={season.end_day}
                      onChange={e => handleSeasonChange(i, 'end_day', parseInt(e.target.value) || 1)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Variazione %</Label>
                    <Input
                      type="number" step="1"
                      value={season.adjustment_percent}
                      onChange={e => handleSeasonChange(i, 'adjustment_percent', parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Note opzionali sulla strategia di pricing"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            <Save className="h-4 w-4 mr-1.5" />
            {editingRule ? 'Aggiorna' : 'Salva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatEuroCompact(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
