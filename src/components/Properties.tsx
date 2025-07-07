
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Settings, Pencil, Car, Home, Calendar, Euro } from 'lucide-react';
import { usePropertiesReal, usePropertiesMobile } from '@/hooks/useProperties';
import type { Tables } from '@/integrations/supabase/types';

const Properties = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'real' | 'mobile'>('all');
  
  const { data: propertiesReal = [], isLoading: isLoadingReal } = usePropertiesReal();
  const { data: propertiesMobile = [], isLoading: isLoadingMobile } = usePropertiesMobile();
  
  const isLoading = isLoadingReal || isLoadingMobile;

  const filteredPropertiesReal = propertiesReal.filter(property => {
    const searchMatch = 
      property.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.via.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.citta.toLowerCase().includes(searchTerm.toLowerCase());
    
    return searchMatch && (filterType === 'all' || filterType === 'real');
  });

  const filteredPropertiesMobile = propertiesMobile.filter(property => {
    const searchMatch = 
      property.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (property.marca && property.marca.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (property.modello && property.modello.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (property.targa && property.targa.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return searchMatch && (filterType === 'all' || filterType === 'mobile');
  });

  const totalFilteredProperties = filteredPropertiesReal.length + filteredPropertiesMobile.length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ottimo': return 'bg-green-100 text-green-800';
      case 'buono': return 'bg-blue-100 text-blue-800';
      case 'discreto': return 'bg-yellow-100 text-yellow-800';
      case 'da_ristrutturare': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'veicolo': return 'bg-blue-100 text-blue-800';
      case 'imbarcazione': return 'bg-cyan-100 text-cyan-800';
      case 'attrezzatura': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderPropertyReal = (property: Tables<'properties_real'>) => (
    <Card key={property.id} className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">{property.nome}</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm">
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center text-gray-600">
          <MapPin className="w-4 h-4 mr-2" />
          <span className="text-sm">{property.via}, {property.citta} ({property.cap})</span>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline">{property.tipo}</Badge>
          {property.stato_conservazione && (
            <Badge className={getStatusColor(property.stato_conservazione)}>
              {property.stato_conservazione}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {property.valore_acquisto && (
            <div>
              <p className="text-gray-600">Valore Acquisto</p>
              <p className="font-semibold">€{Number(property.valore_acquisto).toLocaleString()}</p>
            </div>
          )}
          {property.metri_quadrati && (
            <div>
              <p className="text-gray-600">Metri Quadrati</p>
              <p className="font-semibold">{property.metri_quadrati} m²</p>
            </div>
          )}
          {property.valore_catastale && (
            <div>
              <p className="text-gray-600">Valore Catastale</p>
              <p className="font-semibold">€{Number(property.valore_catastale).toLocaleString()}</p>
            </div>
          )}
          {property.rendita && (
            <div>
              <p className="text-gray-600">Rendita Annua</p>
              <p className="font-semibold">€{Number(property.rendita).toLocaleString()}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" className="flex-1">
            Dettagli
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            Documenti
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderPropertyMobile = (property: Tables<'properties_mobile'>) => (
    <Card key={property.id} className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-green-600" />
            <CardTitle className="text-lg">{property.nome}</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm">
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {property.targa && (
          <div className="flex items-center text-gray-600">
            <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{property.targa}</span>
          </div>
        )}
        
        <div className="flex gap-2 flex-wrap">
          <Badge className={getCategoryColor(property.categoria)}>{property.categoria}</Badge>
          {property.anno && <Badge variant="outline">{property.anno}</Badge>}
          {property.marca && property.modello && (
            <Badge variant="outline">{property.marca} {property.modello}</Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {property.valore_acquisto && (
            <div>
              <p className="text-gray-600">Valore Acquisto</p>
              <p className="font-semibold">€{Number(property.valore_acquisto).toLocaleString()}</p>
            </div>
          )}
          {property.valore_attuale && (
            <div>
              <p className="text-gray-600">Valore Attuale</p>
              <p className="font-semibold">€{Number(property.valore_attuale).toLocaleString()}</p>
            </div>
          )}
          {property.chilometraggio && (
            <div>
              <p className="text-gray-600">Chilometraggio</p>
              <p className="font-semibold">{property.chilometraggio.toLocaleString()} km</p>
            </div>
          )}
          {property.consumo_medio && (
            <div>
              <p className="text-gray-600">Consumo Medio</p>
              <p className="font-semibold">{property.consumo_medio} l/100km</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" className="flex-1">
            Dettagli
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            Manutenzioni
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Proprietà</h1>
        <Button className="bg-blue-600 hover:bg-blue-700">
          Aggiungi Proprietà
        </Button>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Cerca proprietà..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <Select value={filterType} onValueChange={(value) => setFilterType(value as any)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le proprietà</SelectItem>
            <SelectItem value="real">Proprietà Immobiliari</SelectItem>
            <SelectItem value="mobile">Proprietà Mobili</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Caricamento proprietà...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredPropertiesReal.map((property) => renderPropertyReal(property))}
            {filteredPropertiesMobile.map((property) => renderPropertyMobile(property))}
          </div>

          {totalFilteredProperties === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Nessuna proprietà trovata con i criteri di ricerca attuali.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Properties;
