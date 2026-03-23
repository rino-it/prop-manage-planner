import { useState, useEffect, useRef } from 'react';
import { useLanguage } from './LanguageContext';

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

const translationCache = new Map<string, string>();

let batchQueue: { text: string; lang: string; resolve: (val: string) => void }[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

const langMap: Record<string, string> = {
  it: 'it',
  en: 'en-GB',
  de: 'de-DE',
  fr: 'fr-FR',
};

async function translateSingle(text: string, targetLang: string): Promise<string> {
  const langPair = `it|${langMap[targetLang] || targetLang}`;
  const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}&de=kristian.rinaldi.01@gmail.com`;

  const res = await fetch(url);
  if (!res.ok) return text;

  const data = await res.json();
  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    const result = data.responseData.translatedText;
    if (result.toUpperCase() === result && text.toUpperCase() !== text) {
      return text;
    }
    return result;
  }
  return text;
}

async function processBatch() {
  const currentBatch = [...batchQueue];
  batchQueue = [];
  batchTimer = null;

  if (currentBatch.length === 0) return;

  const byLang = new Map<string, typeof currentBatch>();
  for (const item of currentBatch) {
    const group = byLang.get(item.lang) || [];
    group.push(item);
    byLang.set(item.lang, group);
  }

  for (const [lang, items] of byLang) {
    for (const item of items) {
      try {
        const result = await translateSingle(item.text, lang);
        translationCache.set(`${lang}:${item.text}`, result);
        item.resolve(result);
      } catch {
        translationCache.set(`${lang}:${item.text}`, item.text);
        item.resolve(item.text);
      }
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
      batchTimer = setTimeout(processBatch, 100);
    }
  });
}

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

    const requestId = cacheKey;
    lastRequest.current = requestId;
    setTranslated(text);

    queueTranslation(text, language).then(result => {
      if (lastRequest.current === requestId) {
        setTranslated(result);
      }
    });
  }, [text, language]);

  return translated;
}
