import { useState, useEffect, useRef } from 'react';
import { useLanguage } from './LanguageContext';

const LIBRETRANSLATE_URL = 'https://libretranslate.com/translate';

// Cache globale per sessione: "en:Testo originale" → "Translated text"
const translationCache = new Map<string, string>();

// Coda batch: accumula richieste e le invia insieme
let batchQueue: { text: string; lang: string; resolve: (val: string) => void }[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

async function processBatch() {
  const currentBatch = [...batchQueue];
  batchQueue = [];
  batchTimer = null;

  if (currentBatch.length === 0) return;

  // Raggruppa per lingua
  const byLang = new Map<string, typeof currentBatch>();
  for (const item of currentBatch) {
    const group = byLang.get(item.lang) || [];
    group.push(item);
    byLang.set(item.lang, group);
  }

  for (const [lang, items] of byLang) {
    const texts = items.map(i => i.text);
    try {
      const res = await fetch(LIBRETRANSLATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: texts,
          source: 'it',
          target: lang,
          format: 'text',
        }),
      });

      if (!res.ok) {
        // Fallback: restituisci testo originale
        items.forEach(item => {
          translationCache.set(`${lang}:${item.text}`, item.text);
          item.resolve(item.text);
        });
        continue;
      }

      const data = await res.json();

      // LibreTranslate restituisce { translatedText: string | string[] }
      const translated = Array.isArray(data.translatedText)
        ? data.translatedText
        : [data.translatedText];

      items.forEach((item, i) => {
        const result = translated[i] || item.text;
        translationCache.set(`${lang}:${item.text}`, result);
        item.resolve(result);
      });
    } catch {
      // Errore rete: restituisci testo originale
      items.forEach(item => {
        translationCache.set(`${lang}:${item.text}`, item.text);
        item.resolve(item.text);
      });
    }
  }
}

function queueTranslation(text: string, lang: string): Promise<string> {
  const cacheKey = `${lang}:${text}`;
  const cached = translationCache.get(cacheKey);
  if (cached !== undefined) return Promise.resolve(cached);

  return new Promise(resolve => {
    batchQueue.push({ text, lang, resolve });
    if (!batchTimer) {
      // Aspetta 50ms per accumulare più richieste nello stesso tick
      batchTimer = setTimeout(processBatch, 50);
    }
  });
}

/**
 * Hook per tradurre un testo dal DB.
 * Se lingua = 'it', restituisce il testo originale senza chiamate API.
 */
export function useTranslate(text: string | null | undefined): string {
  const { language } = useLanguage();
  const [translated, setTranslated] = useState(text || '');
  const lastRequest = useRef('');

  useEffect(() => {
    if (!text) { setTranslated(''); return; }
    if (language === 'it') { setTranslated(text); return; }

    const cacheKey = `${language}:${text}`;
    const cached = translationCache.get(cacheKey);
    if (cached !== undefined) {
      setTranslated(cached);
      return;
    }

    // Evita richieste duplicate per lo stesso testo
    const requestId = cacheKey;
    lastRequest.current = requestId;

    // Mostra testo originale durante il caricamento
    setTranslated(text);

    queueTranslation(text, language).then(result => {
      if (lastRequest.current === requestId) {
        setTranslated(result);
      }
    });
  }, [text, language]);

  return translated;
}
