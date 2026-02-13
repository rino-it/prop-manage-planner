import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type Income = Tables<'income'>;
type IncomeInsert = TablesInsert<'income'>;

export const useIncome = () => {
  const { toast } = useToast();
  
  return useQuery({
    queryKey: ['income'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('income')
        .select(`
          *,
          properties_real:property_real_id(nome, codice_identificativo),
          properties_mobile:property_mobile_id(nome, codice_identificativo)
        `)
        .order('data_incasso', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    meta: {
      onError: () => {
        toast({
          title: "Errore",
          description: "Impossibile caricare le entrate",
          variant: "destructive",
        });
      },
    },
  });
};

export const useIncomeStats = () => {
  const { toast } = useToast();
  
  return useQuery({
    queryKey: ['income-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('income')
        .select('importo, tipo_entrata, data_incasso')
        .gte('data_incasso', new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
      
      if (error) throw error;
      
      const totalIncome = data?.reduce((sum, income) => sum + Number(income.importo), 0) || 0;
      const monthlyIncome = data?.filter(income => {
        const incomeDate = new Date(income.data_incasso);
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        return incomeDate.getMonth() === currentMonth && incomeDate.getFullYear() === currentYear;
      }).reduce((sum, income) => sum + Number(income.importo), 0) || 0;
      
      const rentalIncome = data?.filter(income => income.tipo_entrata === 'affitto')
        .reduce((sum, income) => sum + Number(income.importo), 0) || 0;
      
      return {
        totalIncome,
        monthlyIncome,
        rentalIncome,
        totalCount: data?.length || 0,
      };
    },
    meta: {
      onError: () => {
        toast({
          title: "Errore",
          description: "Impossibile caricare le statistiche entrate",
          variant: "destructive",
        });
      },
    },
  });
};

export const useCreateIncome = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (income: IncomeInsert) => {
      const { data, error } = await supabase
        .from('income')
        .insert(income)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] });
      queryClient.invalidateQueries({ queryKey: ['income-stats'] });
      queryClient.invalidateQueries({ queryKey: ['property-performance'] });
      toast({
        title: "Entrata registrata",
        description: "L'entrata è stata registrata con successo",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile registrare l'entrata",
        variant: "destructive",
      });
    },
  });
};

export const usePropertyPerformance = () => {
  const { toast } = useToast();
  
  return useQuery({
    queryKey: ['property-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_performance')
        .select('*');
      
      if (error) throw error;
      return data;
    },
    meta: {
      onError: () => {
        toast({
          title: "Errore",
          description: "Impossibile caricare le performance delle proprietà",
          variant: "destructive",
        });
      },
    },
  });
};