import { useTranslate } from '@/i18n/useTranslate';

/**
 * Componente per tradurre testi dinamici dal DB.
 * Uso: <T text={svc.titolo} /> oppure <T text={ticket.descrizione} />
 */
export default function T({ text }: { text: string | null | undefined }) {
  const translated = useTranslate(text);
  return <>{translated}</>;
}
