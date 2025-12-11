import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { useToast } from './use-toast';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  // Aggiornata la firma per accettare i dati completi
  signUp: (email: string, password: string, firstName: string, lastName: string, phone: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        toast({
          variant: "destructive",
          title: "Errore di accesso",
          description: error.message,
        });
        return { error };
      }
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  // FUNZIONE SIGNUP AGGIORNATA
  const signUp = async (email: string, password: string, firstName: string, lastName: string, phone: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // FIX EMAIL: Riporta l'utente alla home del sito attuale
          emailRedirectTo: window.location.origin, 
          // Salviamo i dati nei metadati dell'utente
          data: {
            first_name: firstName,
            last_name: lastName,
            phone: phone, 
          },
        },
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Errore registrazione",
          description: error.message,
        });
        return { error };
      }

      toast({
        title: "Registrazione effettuata",
        description: "Controlla la tua email per confermare l'account.",
      });
      
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};