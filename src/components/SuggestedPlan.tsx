import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, TrendingUp, TrendingDown, Calendar, ArrowRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

export default function SuggestedPlan() {
  // DATE RANGE: Default mese corrente
  const [dateFrom, setDateFrom] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  
  const [selectedProp, setSelectedProp] = useState<string>('all');
  const printRef = useRef<HTMLDivElement>(null);

  // 1. CARICA PROPRIETÀ
  const { data: properties } = useQuery({
    queryKey: ['report-props'],
    queryFn: async () => {
      const { data } = await supabase.from('properties_real').select('*');
      return data || [];
    }
  });

  // 2. CARICA MOVIMENTI
  const { data: reportData } = useQuery({
    queryKey: ['report-data', dateFrom, dateTo, selectedProp],
    queryFn: async () => {
      // Incassi
      const { data: income } = await supabase.from('tenant_payments')
        .select('*, bookings(property_id, nome_ospite)')
        .eq('stato', 'pagato')
        .gte('data_pagamento', dateFrom)
        .lte('data_pagamento', dateTo);

      // Spese
      const { data: expenses } = await supabase.from('property_expenses')
        .select('*, properties_real(nome)')
        .gte('date', dateFrom)
        .lte('date', dateTo);

      let filteredIncome = income || [];
      let filteredExpenses = expenses || [];

      if (selectedProp !== 'all') {
        filteredIncome = filteredIncome.filter(i => i.bookings?.property_id === selectedProp);
        filteredExpenses = filteredExpenses.filter(e => e.property_id === selectedProp);
      }

      return { income: filteredIncome, expenses: filteredExpenses };
    }
  });

  const totalIncome = reportData?.income.reduce((acc, cur) => acc + Number(cur.importo), 0) || 0;
  const totalExpenses = reportData?.expenses.reduce((acc, cur) => acc + Number(cur.amount), 0) || 0;
  const netIncome = totalIncome - totalExpenses;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* BARRA CONTROLLI (Non stampabile) */}
      <div className="flex flex-col xl:flex-row justify-between items-center gap-4 print:hidden bg-white p-4 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportistica</h1>
          <p className="text-gray-500 text-sm">Definisci il periodo e la proprietà per il bilancio.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-2 items-center w-full md:w-auto">
            <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-slate-50 w-full md:w-auto">
                <Calendar className="w-4 h-4 text-gray-500" />
                <div className="flex items-center gap-2 text-sm">
                    <input type="date" className="bg-transparent outline-none cursor-pointer" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}/>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <input type="date" className="bg-transparent outline-none cursor-pointer" value={dateTo} onChange={(e) => setDateTo(e.target.value)}/>
                </div>
            </div>

            <Select value={selectedProp} onValueChange={setSelectedProp}>
                <SelectTrigger className="w-full md:w-[200px] bg-slate-50"><SelectValue placeholder="Tutte le proprietà" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Portafoglio Completo</SelectItem>
                    {properties?.map(p => (<SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>))}
                </SelectContent>
            </Select>

            <Button className="bg-slate-900 text-white hover:bg-slate-800 w-full md:w-auto" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" /> Stampa PDF
            </Button>
        </div>
      </div>

      {/* DOCUMENTO STAMPABILE */}
      <div ref={printRef} className="bg-white p-8 rounded-xl border shadow-sm print:shadow-none print:border-none print:p-0 min-h-[600px]">
        
        {/* INTESTAZIONE CON LOGO REALE */}
        <div className="flex justify-between items-start mb-8 border-b pb-6">
            <div>
                <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Prospetto Finanziario</h2>
                <div className="mt-2 text-slate-500 space-y-1">
                    <p>Periodo: <span className="font-semibold text-slate-900 capitalize">
                        Dal {format(parseISO(dateFrom), 'd MMMM yyyy', { locale: it })} al {format(parseISO(dateTo), 'd MMMM yyyy', { locale: it })}
                    </span></p>
                    <p>Proprietà: <span className="font-semibold text-slate-900">{selectedProp === 'all' ? 'Portafoglio Completo' : properties?.find(p => p.id === selectedProp)?.nome}</span></p>
                </div>
            </div>
            <div className="text-right">
                {/* QUI C'ERA IL LOGO SBAGLIATO, ORA C'È QUELLO VERO */}
                <img src="/prop-manager-logo.svg" alt="Logo" className="h-12 w-auto ml-auto mb-2 object-contain" />
                <p className="text-xs text-gray-400 mt-1">Generato il {format(new Date(), 'dd/MM/yyyy')}</p>
            </div>
        </div>

        {/* KPI BOX */}
        <div className="grid grid-cols-3 gap-6 mb-10">
            <div className="p-5 bg-green-50 rounded-xl border border-green-100 print:border-gray-200">
                <p className="text-xs font-bold text-green-700 uppercase mb-2">Totale Incassi</p>
                <p className="text-3xl font-bold text-green-900">+ € {totalIncome.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-5 bg-red-50 rounded-xl border border-red-100 print:border-gray-200">
                <p className="text-xs font-bold text-red-700 uppercase mb-2">Totale Spese</p>
                <p className="text-3xl font-bold text-red-900">- € {totalExpenses.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className={`p-5 rounded-xl border ${netIncome >= 0 ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-200'} print:border-gray-200`}>
                <p className="text-xs font-bold text-gray-600 uppercase mb-2">Utile Netto</p>
                <p className={`text-3xl font-bold ${netIncome >= 0 ? 'text-orange-900' : 'text-slate-900'}`}>€ {netIncome.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
            </div>
        </div>

        {/* TABELLE */}
        <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-900 uppercase mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" /> Movimenti in Entrata</h3>
            {reportData?.income.length === 0 ? <p className="text-sm text-gray-400 italic pl-6">Nessun incasso in questo periodo.</p> : (
                <Table>
                    <TableHeader><TableRow className="border-b-2 border-slate-100"><TableHead>Data</TableHead><TableHead>Descrizione</TableHead><TableHead className="text-right">Importo</TableHead></TableRow></TableHeader>
                    <TableBody>{reportData?.income.map((item) => (
                        <TableRow key={item.id} className="border-b border-slate-50"><TableCell className="font-mono text-xs text-slate-500">{format(new Date(item.data_pagamento || item.data_scadenza), 'dd/MM/yyyy')}</TableCell><TableCell><span className="font-medium text-slate-900">{item.bookings?.nome_ospite}</span></TableCell><TableCell className="text-right font-bold text-green-700">€ {Number(item.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</TableCell></TableRow>
                    ))}</TableBody>
                </Table>
            )}
        </div>

        <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase mb-4 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-600" /> Movimenti in Uscita</h3>
            {reportData?.expenses.length === 0 ? <p className="text-sm text-gray-400 italic pl-6">Nessuna spesa in questo periodo.</p> : (
                <Table>
                    <TableHeader><TableRow className="border-b-2 border-slate-100"><TableHead>Data</TableHead><TableHead>Descrizione</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Importo</TableHead></TableRow></TableHeader>
                    <TableBody>{reportData?.expenses.map((item) => (
                        <TableRow key={item.id} className="border-b border-slate-50"><TableCell className="font-mono text-xs text-slate-500">{format(new Date(item.date), 'dd/MM/yyyy')}</TableCell><TableCell className="font-medium text-slate-900">{item.description}</TableCell><TableCell className="text-xs text-slate-400 uppercase">{item.category}</TableCell><TableCell className="text-right font-bold text-red-700">- € {Number(item.amount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</TableCell></TableRow>
                    ))}</TableBody>
                </Table>
            )}
        </div>
      </div>
      <style>{`@media print { body * { visibility: hidden; } #root { display: block; } nav, header, .print\\:hidden { display: none !important; } .bg-white.p-8.rounded-xl { visibility: visible; position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; box-shadow: none; border: none; } .bg-white.p-8.rounded-xl * { visibility: visible; } }`}</style>
    </div>
  );
}