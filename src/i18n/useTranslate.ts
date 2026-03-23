import { useState, useEffect, useRef } from 'react';
import { useLanguage } from './LanguageContext';

const DEEPL_API_KEY = import.meta.env.VITE_DEEPL_API_KEY || '';
const DEEPL_URL = 'https://api-free.deepl.com/v2/translate';
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

const translationCache = new Map<string, string>();

let batchQueue: { text: string; lang: string; resolve: (val: string) => void }[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

const deeplLangMap: Record<string, string> = {
  en: 'EN-GB',
  de: 'DE',
  fr: 'FR',
};

const mymemoryLangMap: Record<string, string> = {
  en: 'en-GB',
  de: 'de-DE',
  fr: 'fr-FR',
};

async function translateWithDeepL(texts: string[], targetLang: string): Promise<string[]> {
  const target = deeplLangMap[targetLang];
  if (!target || !DEEPL_API_KEY) throw new Error('DeepL not configured');

  const params = new URLSearchParams();
  texts.forEach(t => params.append('text', t));
  params.append('source_lang', 'IT');
  params.append('target_lang', target);

  const res = await fetch(DEEPL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) throw new Error(`DeepL ${res.status}`);

  const data = await res.json();
  return data.translations.map((t: { text: string }) => t.text);
}

async function translateWithMyMemory(text: string, targetLang: string): Promise<string> {
  const langPair = `it|${mymemoryLangMap[targetLang] || targetLang}`;
  const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}`;

  const res = await fetch(url);
  if (!res.ok) return text;

  const data = await res.json();
  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    const result = data.responseData.translatedText;
    if (result.toUpperCase() === result && text.toUpperCase() !== text) return text;
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
    if (DEEPL_API_KEY) {
      try {
        const texts = items.map(i => i.text);
        const results = await translateWithDeepL(texts, lang);
        items.forEach((item, i) => {
          const result = results[i] || item.text;
          translationCache.set(`${lang}:${item.text}`, result);
          item.resolve(result);
        });
        continue;
      } catch {
        // DeepL failed, fall through to MyMemory
      }
    }

    for (const item of items) {
      try {
        const result = await translateWithMyMemory(item.text, lang);
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
      batchTimer = setTimeout(processBatch, DEEPL_API_KEY ? 80 : 100);
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
