import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, X, Send, RotateCcw, Bot, User, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Suggerimenti contestuali per pagina ─────────────────────────────────────
const PAGE_SUGGESTIONS: Record<string, string[]> = {
  '/':             ['Come funziona la dashboard?', 'Da dove inizio?', 'Come navigare la webapp?'],
  '/revenue':      ['Come registro un incasso?', 'Come creo un piano rateale?', 'Come confermo un pagamento ricevuto?'],
  '/expenses':     ['Come registro una spesa?', 'Come allego una ricevuta?', 'Quali categorie di spesa esistono?'],
  '/activities':   ['Come creo un\'attività?', 'Differenza calendario vs Da Schedulare?', 'Come assegno una data?'],
  '/bookings':     ['Come creo una prenotazione?', 'Come aggiungo un pagamento?', 'Come gestisco la cauzione?'],
  '/properties':   ['Come aggiungo una proprietà?', 'Come modifico una proprietà?', 'Cosa è il codice identificativo?'],
  '/tenants':      ['Come registro un inquilino?', 'Come carico i documenti?', 'Come creo un piano rateale?'],
  '/accoglienza':  ['Come invio istruzioni check-in?', 'Come approvo un documento?', 'Come invio un template?'],
  '/team':         ['Come aggiungo un membro?', 'Come cambio i permessi?', 'Come sospendo un utente?'],
  '/tickets':      ['Come creo un ticket?', 'Come chiudo un ticket?', 'Come delegare a un tecnico?'],
  '/portali':      ['Come collego Airbnb?', 'Come sincronizza il calendario?', 'Come gestisco i conflitti?'],
  '/statistiche':  ['Come leggere le statistiche?', 'Come filtrare per proprietà?', 'Cosa mostra l\'occupancy?'],
  '/messaggi':     ['Come invio un messaggio?', 'Come uso i template?', 'Quali canali sono disponibili?'],
  '/prezzi':       ['Come imposto le tariffe?', 'Come creo stagionalità?', 'Come funziona il prezzo minimo?'],
  '/mobile-properties': ['Come aggiungo un veicolo?', 'Come registro la targa?', 'Come gestisco le spese veicolo?'],
};

function getSuggestions(pathname: string): string[] {
  const key = Object.keys(PAGE_SUGGESTIONS).find(k => pathname === k || (k !== '/' && pathname.startsWith(k)));
  return PAGE_SUGGESTIONS[key || '/'] || PAGE_SUGGESTIONS['/'];
}

// ─── Renderer markdown minimo ─────────────────────────────────────────────────
function renderMessage(text: string) {
  // Numeri con punto (1. 2. 3.)
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Bold **text**
    const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Lista numerata
    if (/^\d+\.\s/.test(line)) {
      return (
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-blue-500 font-bold shrink-0">{line.match(/^\d+/)?.[0]}.</span>
          <span dangerouslySetInnerHTML={{ __html: boldLine.replace(/^\d+\.\s/, '') }} />
        </div>
      );
    }
    // Lista trattino
    if (/^[-•]\s/.test(line)) {
      return (
        <div key={i} className="flex gap-2 my-0.5 ml-2">
          <span className="text-slate-400 shrink-0">•</span>
          <span dangerouslySetInnerHTML={{ __html: boldLine.replace(/^[-•]\s/, '') }} />
        </div>
      );
    }
    // Header ##
    if (/^##\s/.test(line)) {
      return <p key={i} className="font-bold text-slate-700 mt-2 mb-1" dangerouslySetInnerHTML={{ __html: boldLine.replace(/^##\s/, '') }} />;
    }
    // Blockquote (> nota)
    if (/^>\s/.test(line)) {
      return (
        <div key={i} className="border-l-2 border-blue-300 pl-2 text-xs text-slate-500 my-1 italic">
          {line.replace(/^>\s/, '')}
        </div>
      );
    }
    // Linea vuota
    if (line.trim() === '') return <div key={i} className="h-1" />;
    // Normale
    return <p key={i} className="my-0.5" dangerouslySetInnerHTML={{ __html: boldLine }} />;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function FloatingChatbot() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Ciao! 👋 Sono l\'assistente di **PropManager**.\n\nPosso guidarti step-by-step su come usare qualsiasi funzione dell\'app.\n\nCosa vuoi fare?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = getSuggestions(location.pathname);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 100);
    }
  }, [open, messages]);

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg: Message = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('app-assistant', {
        body: {
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          currentPage: location.pathname,
        },
      });

      if (error) throw error;

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Nessuna risposta.' }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Errore di connessione. Controlla la rete e riprova.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([{
      role: 'assistant',
      content: 'Conversazione resettata. Come posso aiutarti?',
    }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const hasSuggestions = messages.length <= 2;

  return (
    <>
      {/* ── Panel chat ── */}
      {open && (
        <div className="fixed bottom-20 right-4 z-[9998] w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          style={{ height: '520px' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">Assistente PropManager</p>
                <p className="text-[10px] text-blue-200">Tutorial & Guida all'uso</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Reset conversazione"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5
                  ${msg.role === 'assistant' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-600'}`}>
                  {msg.role === 'assistant'
                    ? <Bot className="w-3.5 h-3.5" />
                    : <User className="w-3.5 h-3.5" />}
                </div>
                {/* Bubble */}
                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed
                  ${msg.role === 'assistant'
                    ? 'bg-slate-100 text-slate-800 rounded-tl-sm'
                    : 'bg-blue-600 text-white rounded-tr-sm'}`}>
                  {msg.role === 'assistant'
                    ? <div>{renderMessage(msg.content)}</div>
                    : <p>{msg.content}</p>}
                </div>
              </div>
            ))}

            {/* Loading */}
            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                  <span className="text-xs text-slate-500">Sto cercando la risposta...</span>
                </div>
              </div>
            )}

            {/* Suggerimenti contestuali */}
            {hasSuggestions && !loading && (
              <div className="mt-2">
                <p className="text-[10px] text-slate-400 mb-2 font-medium uppercase tracking-wide">
                  Domande frequenti per questa pagina
                </p>
                <div className="flex flex-col gap-1.5">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="text-left text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 rounded-xl px-3 py-2 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-slate-100 shrink-0 bg-white">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Chiedi come fare qualcosa..."
                className="text-sm h-9 rounded-xl border-slate-200 focus-visible:ring-blue-400"
                disabled={loading}
              />
              <Button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                size="icon"
                className="h-9 w-9 rounded-xl bg-blue-600 hover:bg-blue-700 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Enter per inviare · Powered by Claude AI
            </p>
          </div>
        </div>
      )}

      {/* ── Floating button ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-4 right-4 z-[9999] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95
          ${open ? 'bg-slate-700 hover:bg-slate-800' : 'bg-blue-600 hover:bg-blue-700'}`}
        title="Assistente PropManager"
      >
        {open
          ? <X className="w-5 h-5 text-white" />
          : <MessageCircle className="w-6 h-6 text-white" />}

        {/* Pulse dot — solo quando chiuso */}
        {!open && (
          <span className="absolute top-1 right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
        )}
      </button>
    </>
  );
}
