
export interface BaseProperty {
  id: number;
  dataAcquisto: string;
  valoreAcquisto: number;
}

export interface PropertyImmobiliare extends BaseProperty {
  tipo: 'immobiliare';
  indirizzo: string;
  tipoImmobile: 'Appartamento' | 'Villa' | 'Ufficio' | 'Negozio' | 'Magazzino' | 'Altro';
  stato: 'In Affitto' | 'In Vendita' | 'In Manutenzione' | 'Libero';
  canoneAffittoMensile?: number;
  dataInizioContratto?: string;
  dataFineContratto?: string;
  nomeInquilino?: string;
  tassePagateAnno?: number;
  incassiAffittiAnno?: number;
  noteDocumentazione?: string;
}

export interface PropertyMobile extends BaseProperty {
  tipo: 'mobile';
  tipoBeneMobile: 'Auto' | 'Moto' | 'Furgone' | 'Altro';
  marca: string;
  modello: string;
  annoImmatricolazione: number;
  targa: string;
  multe: Multa[];
  documenti: string;
  interventiMeccanico: InterventoMeccanico[];
  scadenzaBollo: string;
  scadenzaAssicurazione: string;
  scadenzaRevisione: string;
}

export interface Multa {
  id: number;
  data: string;
  importo: number;
  descrizione: string;
}

export interface InterventoMeccanico {
  id: number;
  data: string;
  descrizione: string;
  costo: number;
}

export type Property = PropertyImmobiliare | PropertyMobile;
