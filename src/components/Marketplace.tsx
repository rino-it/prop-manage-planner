import React, { useState } from 'react';
import {
  Store, ExternalLink, Search, Filter,
  DoorOpen, Sparkles, TrendingUp, Settings2,
  CheckCircle2, Circle, ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ServiceStatus = 'available' | 'connected' | 'coming_soon';

interface MarketplaceService {
  id: string;
  name: string;
  description: string;
  category: string;
  status: ServiceStatus;
  website: string;
  features: string[];
  logo?: string;
}

const CATEGORIES = [
  { value: 'all', label: 'Tutte le categorie', icon: Store },
  { value: 'accoglienza', label: 'Accoglienza digitale', icon: DoorOpen },
  { value: 'pulizie', label: 'Pulizie e turnover', icon: Sparkles },
  { value: 'prezzi', label: 'Prezzi dinamici', icon: TrendingUp },
  { value: 'operativo', label: 'Ottimizzazione operativa', icon: Settings2 },
] as const;

const SERVICES: MarketplaceService[] = [
  {
    id: 'yaago',
    name: 'Yaago',
    description: 'Welcome booklet interattivo per gli ospiti. Guida digitale personalizzabile con informazioni su check-in, attrazioni locali e regole della casa.',
    category: 'accoglienza',
    status: 'available',
    website: 'https://www.yaago.com',
    features: ['Welcome booklet digitale', 'Guide personalizzabili', 'Multilingua automatico', 'QR code per accesso rapido'],
  },
  {
    id: 'chekin',
    name: 'Chekin',
    description: 'Check-in online automatizzato con verifica documenti, firma contratti e invio dati alle autorita locali.',
    category: 'accoglienza',
    status: 'available',
    website: 'https://chekin.com',
    features: ['Check-in online', 'Verifica identita', 'Firma digitale contratti', 'Invio dati Alloggiati Web'],
  },
  {
    id: 'turno',
    name: 'Turno',
    description: 'Gestione completa dei servizi di pulizia e turnover tra ospiti. Assegnazione automatica, checklist e reportistica.',
    category: 'pulizie',
    status: 'available',
    website: 'https://turno.com',
    features: ['Scheduling automatico', 'Checklist pulizie', 'Notifiche al team', 'Report qualita'],
  },
  {
    id: 'properly',
    name: 'Properly',
    description: 'Piattaforma per coordinare pulizie e manutenzione con checklist fotografiche e ispezioni remote.',
    category: 'pulizie',
    status: 'available',
    website: 'https://www.properly.com',
    features: ['Checklist fotografiche', 'Ispezione remota', 'Gestione team', 'Standard qualita'],
  },
  {
    id: 'pricelabs',
    name: 'PriceLabs',
    description: 'Revenue management con pricing dinamico basato su domanda, stagionalita, eventi locali e analisi competitiva.',
    category: 'prezzi',
    status: 'available',
    website: 'https://pricelabs.co',
    features: ['Pricing dinamico', 'Analisi competitiva', 'Regole personalizzabili', 'Sync multi-portale'],
  },
  {
    id: 'beyond',
    name: 'Beyond (ex Beyond Pricing)',
    description: 'Ottimizzazione automatica dei prezzi con algoritmi di machine learning e dati di mercato in tempo reale.',
    category: 'prezzi',
    status: 'available',
    website: 'https://www.beyondpricing.com',
    features: ['ML-based pricing', 'Dati mercato real-time', 'Dashboard revenue', 'A/B testing prezzi'],
  },
  {
    id: 'prohost',
    name: 'ProHost Solutions',
    description: 'Suite di strumenti per ottimizzare la gestione operativa: automazioni, task management e analytics per property manager.',
    category: 'operativo',
    status: 'coming_soon',
    website: 'https://www.prohostsolutions.com',
    features: ['Automazioni workflow', 'Task management', 'Analytics avanzati', 'Integrazioni API'],
  },
  {
    id: 'hostaway',
    name: 'Hostaway',
    description: 'Channel manager e PMS completo con automazione messaggi, gestione prenotazioni e reportistica centralizzata.',
    category: 'operativo',
    status: 'available',
    website: 'https://www.hostaway.com',
    features: ['Channel manager', 'Automazione messaggi', 'Report centralizzati', 'API aperte'],
  },
];

const STATUS_CONFIG: Record<ServiceStatus, { label: string; variant: 'default' | 'secondary' | 'outline'; icon: React.ElementType }> = {
  connected: { label: 'Connesso', variant: 'default', icon: CheckCircle2 },
  available: { label: 'Disponibile', variant: 'secondary', icon: Circle },
  coming_soon: { label: 'Prossimamente', variant: 'outline', icon: Circle },
};

const CATEGORY_COLORS: Record<string, string> = {
  accoglienza: 'bg-emerald-50 border-emerald-200',
  pulizie: 'bg-violet-50 border-violet-200',
  prezzi: 'bg-amber-50 border-amber-200',
  operativo: 'bg-sky-50 border-sky-200',
};

const CATEGORY_ICON_COLORS: Record<string, string> = {
  accoglienza: 'text-emerald-600 bg-emerald-100',
  pulizie: 'text-violet-600 bg-violet-100',
  prezzi: 'text-amber-600 bg-amber-100',
  operativo: 'text-sky-600 bg-sky-100',
};

function getCategoryIcon(category: string): React.ElementType {
  return CATEGORIES.find(c => c.value === category)?.icon || Store;
}

function getCategoryLabel(category: string): string {
  return CATEGORIES.find(c => c.value === category)?.label || category;
}

export default function Marketplace() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filtered = SERVICES.filter(service => {
    const matchesSearch = !searchTerm
      || service.name.toLowerCase().includes(searchTerm.toLowerCase())
      || service.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || service.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryCounts = SERVICES.reduce<Record<string, number>>((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Store className="h-6 w-6" />
            Marketplace Servizi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catalogo di servizi integrabili per potenziare la gestione delle proprieta
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {SERVICES.length} servizi disponibili
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CATEGORIES.filter(c => c.value !== 'all').map(cat => {
          const Icon = cat.icon;
          const count = categoryCounts[cat.value] || 0;
          const isActive = selectedCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(isActive ? 'all' : cat.value)}
              className={`p-3 rounded-lg border text-left transition-all ${
                isActive
                  ? `${CATEGORY_COLORS[cat.value]} ring-1 ring-primary/20`
                  : 'bg-white border-border hover:border-primary/30'
              }`}
            >
              <div className={`inline-flex p-1.5 rounded-md ${CATEGORY_ICON_COLORS[cat.value]}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="mt-2 text-xs font-medium text-foreground">{cat.label}</div>
              <div className="text-xs text-muted-foreground">{count} servizi</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca servizi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Store className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nessun servizio trovato con i filtri selezionati.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(service => {
            const statusCfg = STATUS_CONFIG[service.status];
            const StatusIcon = statusCfg.icon;
            const CategoryIcon = getCategoryIcon(service.category);

            return (
              <Card
                key={service.id}
                className={`flex flex-col transition-shadow hover:shadow-md ${
                  service.status === 'coming_soon' ? 'opacity-75' : ''
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${CATEGORY_ICON_COLORS[service.category]}`}>
                        <CategoryIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{service.name}</CardTitle>
                        <span className="text-xs text-muted-foreground">
                          {getCategoryLabel(service.category)}
                        </span>
                      </div>
                    </div>
                    <Badge variant={statusCfg.variant} className="flex-shrink-0 text-xs gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {statusCfg.label}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {service.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {service.features.map(feature => (
                      <span
                        key={feature}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto pt-2">
                    {service.status === 'coming_soon' ? (
                      <Button variant="outline" className="w-full" disabled>
                        Prossimamente
                      </Button>
                    ) : service.status === 'connected' ? (
                      <Button variant="outline" className="w-full gap-2">
                        <Settings2 className="h-4 w-4" />
                        Gestisci
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => window.open(service.website, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Scopri di piu
                        <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Hai un servizio da suggerire? Le integrazioni API vengono aggiunte incrementalmente.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Fase A: link esterni e documentazione  |  Fase B: integrazione API diretta
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
