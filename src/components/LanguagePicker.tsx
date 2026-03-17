import { useLanguage } from '@/i18n/LanguageContext';
import { Language, languageLabels } from '@/i18n/translations';

const languages: Language[] = ['it', 'en', 'de', 'fr'];

export default function LanguagePicker() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex gap-1">
      {languages.map((lang) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
            language === lang
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {languageLabels[lang]}
        </button>
      ))}
    </div>
  );
}
