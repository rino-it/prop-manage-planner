import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ScanLine, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import { extractDocumentData, isIdentityDocument, type OcrDocumentResult } from '@/utils/ocrDocument';

interface OcrDocumentUploadProps {
  onExtracted?: (data: OcrDocumentResult['extracted']) => void;
  compact?: boolean;
}

export function OcrDocumentUpload({ onExtracted, compact = false }: OcrDocumentUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<OcrDocumentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isIdentityDocument(file)) {
      setError('Formato file non supportato. Usa JPEG, PNG o WebP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File troppo grande. Massimo 5 MB.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const ocrResult = await extractDocumentData(file);
      setResult(ocrResult);

      if (ocrResult.success && ocrResult.extracted) {
        onExtracted?.(ocrResult.extracted);
      } else {
        setError('Impossibile estrarre dati dal documento. Riprova con una foto piu nitida.');
      }
    } catch {
      setError('Errore durante l\'elaborazione. Verifica la connessione e riprova.');
    } finally {
      setIsProcessing(false);
    }
  }, [onExtracted]);

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors relative">
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={handleFileChange}
            disabled={isProcessing}
          />
          {isProcessing ? (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Analisi documento in corso...
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <ScanLine className="w-4 h-4" />
              Scansiona documento d'identita
            </div>
          )}
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="w-3 h-3" />
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ScanLine className="w-4 h-4" />
          OCR Documento d'Identita
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors relative">
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={handleFileChange}
            disabled={isProcessing}
          />
          {isProcessing ? (
            <div className="space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
              <p className="text-sm text-slate-500">Analisi OCR in corso...</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm text-slate-500">Carica una foto del documento d'identita</p>
              <p className="text-xs text-slate-400">Carta d'identita, passaporto o patente</p>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-1.5 text-sm text-red-600 bg-red-50 p-2 rounded">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {result?.success && result.extracted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Dati estratti con successo
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {result.extracted.nome && (
                <div><Label className="text-[10px] text-slate-500">Nome</Label><p className="font-medium">{result.extracted.nome}</p></div>
              )}
              {result.extracted.cognome && (
                <div><Label className="text-[10px] text-slate-500">Cognome</Label><p className="font-medium">{result.extracted.cognome}</p></div>
              )}
              {result.extracted.data_nascita && (
                <div><Label className="text-[10px] text-slate-500">Data Nascita</Label><p className="font-medium">{result.extracted.data_nascita}</p></div>
              )}
              {result.extracted.codice_fiscale && (
                <div><Label className="text-[10px] text-slate-500">Codice Fiscale</Label><p className="font-medium font-mono">{result.extracted.codice_fiscale}</p></div>
              )}
              {result.extracted.numero_documento && (
                <div><Label className="text-[10px] text-slate-500">N. Documento</Label><p className="font-medium">{result.extracted.numero_documento}</p></div>
              )}
              {result.extracted.data_scadenza && (
                <div><Label className="text-[10px] text-slate-500">Scadenza</Label><p className="font-medium">{result.extracted.data_scadenza}</p></div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
