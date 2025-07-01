
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MapPin, Settings, Pencil } from 'lucide-react';

const Properties = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const properties = [
    {
      id: 1,
      name: 'Appartamento Via Roma 123',
      type: 'Residenziale',
      address: 'Via Roma 123, Milano',
      value: 250000,
      status: 'Affittato',
      tenant: 'Mario Rossi',
      monthlyRent: 1200,
      condition: 'Buona'
    },
    {
      id: 2,
      name: 'Ufficio Corso Milano 45',
      type: 'Commerciale',
      address: 'Corso Milano 45, Milano',
      value: 180000,
      status: 'Libero',
      tenant: null,
      monthlyRent: 0,
      condition: 'Ottima'
    },
    {
      id: 3,
      name: 'Magazzino Via Verdi 78',
      type: 'Industriale',
      address: 'Via Verdi 78, Milano',
      value: 120000,
      status: 'Affittato',
      tenant: 'Logistica SRL',
      monthlyRent: 800,
      condition: 'Discreta'
    }
  ];

  const filteredProperties = properties.filter(property =>
    property.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    property.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Affittato': return 'bg-green-100 text-green-800';
      case 'Libero': return 'bg-yellow-100 text-yellow-800';
      case 'Manutenzione': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'Ottima': return 'bg-green-100 text-green-800';
      case 'Buona': return 'bg-blue-100 text-blue-800';
      case 'Discreta': return 'bg-yellow-100 text-yellow-800';
      case 'Scarsa': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredProperties.map((property) => (
          <Card key={property.id} className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{property.name}</CardTitle>
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
                <span className="text-sm">{property.address}</span>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{property.type}</Badge>
                <Badge className={getStatusColor(property.status)}>
                  {property.status}
                </Badge>
                <Badge className={getConditionColor(property.condition)}>
                  {property.condition}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Valore</p>
                  <p className="font-semibold">€{property.value.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">Affitto mensile</p>
                  <p className="font-semibold">
                    {property.monthlyRent > 0 ? `€${property.monthlyRent}` : 'N/A'}
                  </p>
                </div>
              </div>

              {property.tenant && (
                <div className="pt-2 border-t">
                  <p className="text-gray-600 text-sm">Inquilino</p>
                  <p className="font-semibold">{property.tenant}</p>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" className="flex-1">
                  Dettagli
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  Cronologia
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Properties;
