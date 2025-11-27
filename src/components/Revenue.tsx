import React, { useState } from 'react';
import { useRevenue } from '@/hooks/useRevenue';
import { usePropertiesReal } from '@/hooks/useProperties';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TrendingUp, Plus, DollarSign, Calendar as CalendarIcon, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function Revenue() {
  const { revenues, addRevenue, deleteRevenue, isLoading } = useRevenue();
  const { data: properties } = usePropertiesReal();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'affitto',
    property_id: '',
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.property_id) return;
    
    await addRevenue.mutateAsync({
      ...formData,
      amount: parseFloat(formData.amount),
      category: formData.category as any
    });
    
    setIsDialogOpen(false);
    setFormData({ ...formData, amount: '', description: '' });
  };

  const totalRevenue = revenues?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Incassi</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" /> Registra Incasso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuovo Incasso</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label>Proprietà</Label>
                <Select onValueChange={(v) => setFormData({...formData, property_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    {properties?.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="grid gap-2">
                    <Label>Importo (€)</Label>
                    <Input type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                 </div>
                 <div className="grid gap-2">
                    <Label>Data</Label>
                    <Input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                 </div>
              </div>
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select onValueChange={(v) => setFormData({...formData, category: v})} defaultValue="affitto">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="affitto">Canone Affitto</SelectItem>
                    <SelectItem value="extra">Extra / Pulizie</SelectItem>
                    <SelectItem value="deposito">Deposito Cauzionale</SelectItem>
                    <SelectItem value="rimborso">Rimborso Utenze</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Note</Label>
                <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Es. Bonifico Mario Rossi" />
              </div>
              <Button type="submit" className="w-full bg-green-600">Salva</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI CARD */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-green-100 rounded-full text-green-700"><DollarSign className="w-8 h-8" /></div>
            <div>
                <p className="text-sm text-green-700 font-medium">Totale Incassato</p>
                <h2 className="text-3xl font-bold text-green-900">€ {totalRevenue.toLocaleString()}</h2>
            </div>
        </CardContent>
      </Card>

      {/* TABELLA */}
      <Card>
        <CardHeader><CardTitle>Storico Movimenti</CardTitle></CardHeader>
        <CardContent>
            <div className="space-y-2">
                {isLoading ? <p>Caricamento...</p> : revenues?.map((rev) => (
                    <div key={rev.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-green-100 text-green-700 rounded-full"><TrendingUp className="w-5 h-5" /></div>
                            <div>
                                <p className="font-bold text-gray-900">{rev.properties_real?.nome || 'Generale'}</p>
                                <p className="text-sm text-gray-500 capitalize">{rev.category} • {rev.description}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <p className="font-bold text-green-600">+ €{rev.amount}</p>
                                <p className="text-xs text-gray-400">{format(new Date(rev.date), 'dd MMM yyyy')}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteRevenue.mutate(rev.id)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ))}
                {revenues?.length === 0 && <div className="text-center py-8 text-gray-400">Nessun incasso registrato.</div>}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}