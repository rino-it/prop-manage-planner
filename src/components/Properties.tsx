
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Settings, Pencil, Car, Home, Calendar, Euro } from 'lucide-react';
import { Property, PropertyImmobiliare, PropertyMobile } from '@/types/Property';

const Properties = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'immobiliare' | 'mobile'>('all');
  
  // Dati di esempio combinando proprietà immobiliari e mobili
  const properties: Property[] = [
    {
      id: 1,
      tipo: 'immobiliare',
      indirizzo: 'Via Roma 123, Milano',
      tipoImmobile: 'Appartamento',
      stato: 'In Affitto',
      dataAcquisto: '2020-03-15',
      valoreAcquisto: 250000,
      canoneAffittoMensile: 1200,
      dataInizioContratto: '2023-01-01',
      dataFineContratto: '2025-12-31',
      nomeInquilino: 'Mario Rossi',
      tassePagateAnno: 2500,
      incassiAffittiAnno: 14400,
      noteDocumentazione: 'Rogito disponibile, APE classe B'
    },
    {
      id: 2,
      tipo: 'immobiliare',
      indirizzo: 'Corso Milano 45, Milano',
      tipoImmobile: 'Ufficio',
      stato: 'Libero',
      dataAcquisto: '2019-06-20',
      valoreAcquisto: 180000,
      noteDocumentazione: 'Planimetrie aggiornate'
    },
    {
      id: 3,
      tipo: 'mobile',
      tipoBeneMobile: 'Auto',
      marca: 'BMW',
      modello: 'Serie 3',
      annoImmatricolazione: 2020,
      targa: 'AB123CD',
      dataAcquisto: '2020-09-10',
      valoreAcquisto: 35000,
      multe: [
        { id: 1, data: '2023-05-15', importo: 80, descrizione: 'Eccesso di velocità' }
      ],
      documenti: 'Libretto, Certificato proprietà, Assicurazione',
      interventiMeccanico: [
        { id: 1, data: '2023-03-10', descrizione: 'Cambio olio e filtri', costo: 150 }
      ],
      scadenzaBollo: '2024-12-31',
      scadenzaAssicurazione: '2024-08-15',
      scadenzaRevisione: '2024-09-10'
    },
    {
      id: 4,
      tipo: 'mobile',
      tipoBeneMobile: 'Moto',
      marca: 'Yamaha',
      modello: 'MT-07',
      annoImmatricolazione: 2022,
      targa: 'EF456GH',
      dataAcquisto: '2022-04-20',
      valoreAcquisto: 7500,
      multe: [],
      documenti: 'Libretto, Assicurazione',
      interventiMeccanico: [],
      scadenzaBollo: '2024-04-30',
      scadenzaAssicurazione: '2024-07-20',
      scadenzaRevisione: '2025-04-20'
    }
  ];

  const filteredProperties = properties.filter(property => {
    const matchesSearch = 
      (property.tipo === 'immobiliare' && 
       (property as PropertyImmobiliare).indirizzo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (property.tipo === 'mobile' && 
       (`${(property as PropertyMobile).marca} ${(property as PropertyMobile).modello} ${(property as PropertyMobile).targa}`)
         .toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = filterType === 'all' || property.tipo === filterType;
    
    return matchesSearch && matchesType;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Affitto': return 'bg-green-100 text-green-800';
      case 'Libero': return 'bg-yellow-100 text-yellow-800';
      case 'In Manutenzione': return 'bg-red-100 text-red-800';
      case 'In Vendita': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isScadenzaVicina = (dataScadenza: string) => {
    const scadenza = new Date(dataScadenza);
    const oggi = new Date();
    const diffGiorni = Math.ceil((scadenza.getTime() - oggi.getTime()) / (1000 * 3600 * 24));
    return diffGiorni <= 30;
  };

  const renderPropertyImmobiliare = (property: PropertyImmobiliare) => (
    <Card key={property.id} className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">{property.tipoImmobile}</CardTitle>
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
          <span className="text-sm">{property.indirizzo}</span>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline">{property.tipoImmobile}</Badge>
          <Badge className={getStatusColor(property.stato)}>
            {property.stato}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Valore Acquisto</p>
            <p className="font-semibold">€{property.valoreAcquisto.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-600">Data Acquisto</p>
            <p className="font-semibold">{new Date(property.dataAcquisto).toLocaleDateString()}</p>
          </div>
          {property.canoneAffittoMensile && (
            <>
              <div>
                <p className="text-gray-600">Affitto Mensile</p>
                <p className="font-semibold">€{property.canoneAffittoMensile}</p>
              </div>
              <div>
                <p className="text-gray-600">Incassi Anno</p>
                <p className="font-semibold">€{property.incassiAffittiAnno || 0}</p>
              </div>
            </>
          )}
        </div>

        {property.nomeInquilino && (
          <div className="pt-2 border-t">
            <p className="text-gray-600 text-sm">Inquilino</p>
            <p className="font-semibold">{property.nomeInquilino}</p>
            {property.dataFineContratto && (
              <p className="text-xs text-gray-500">
                Contratto fino al {new Date(property.dataFineContratto).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

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

  const renderPropertyMobile = (property: PropertyMobile) => (
    <Card key={property.id} className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-green-600" />
            <CardTitle className="text-lg">{property.marca} {property.modello}</CardTitle>
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
          <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{property.targa}</span>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline">{property.tipoBeneMobile}</Badge>
          <Badge variant="outline">{property.annoImmatricolazione}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Valore Acquisto</p>
            <p className="font-semibold">€{property.valoreAcquisto.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-600">Data Acquisto</p>
            <p className="font-semibold">{new Date(property.dataAcquisto).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-sm flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            Scadenze
          </h4>
          <div className="grid grid-cols-1 gap-1 text-xs">
            <div className={`flex justify-between ${isScadenzaVicina(property.scadenzaBollo) ? 'text-red-600 font-semibold' : ''}`}>
              <span>Bollo:</span>
              <span>{new Date(property.scadenzaBollo).toLocaleDateString()}</span>
            </div>
            <div className={`flex justify-between ${isScadenzaVicina(property.scadenzaAssicurazione) ? 'text-red-600 font-semibold' : ''}`}>
              <span>Assicurazione:</span>
              <span>{new Date(property.scadenzaAssicurazione).toLocaleDateString()}</span>
            </div>
            <div className={`flex justify-between ${isScadenzaVicina(property.scadenzaRevisione) ? 'text-red-600 font-semibold' : ''}`}>
              <span>Revisione:</span>
              <span>{new Date(property.scadenzaRevisione).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {property.multe.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-red-600 text-sm font-semibold">Multe Pendenti: {property.multe.length}</p>
            <p className="text-red-600 text-xs">
              Totale: €{property.multe.reduce((sum, multa) => sum + multa.importo, 0)}
            </p>
          </div>
        )}

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
            <SelectItem value="immobiliare">Proprietà Immobiliari</SelectItem>
            <SelectItem value="mobile">Proprietà Mobili</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredProperties.map((property) => 
          property.tipo === 'immobiliare' 
            ? renderPropertyImmobiliare(property as PropertyImmobiliare)
            : renderPropertyMobile(property as PropertyMobile)
        )}
      </div>

      {filteredProperties.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Nessuna proprietà trovata con i criteri di ricerca attuali.</p>
        </div>
      )}
    </div>
  );
};

export default Properties;
