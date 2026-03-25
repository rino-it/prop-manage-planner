import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SeasonAdjustment {
  name: string;
  start_month: number;
  start_day: number;
  end_month: number;
  end_day: number;
  adjustment_percent: number;
  adjustment_fixed: number;
}

export interface PricingRule {
  id: string;
  property_id: string;
  base_price: number;
  min_price: number | null;
  max_price: number | null;
  strategy: 'manual' | 'dynamic';
  season_adjustments: SeasonAdjustment[];
  weekend_adjustment: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface PricingRuleInsert {
  property_id: string;
  base_price: number;
  min_price?: number | null;
  max_price?: number | null;
  strategy?: 'manual' | 'dynamic';
  season_adjustments?: SeasonAdjustment[];
  weekend_adjustment?: number;
  notes?: string | null;
}

export interface PricingRuleUpdate {
  base_price?: number;
  min_price?: number | null;
  max_price?: number | null;
  strategy?: 'manual' | 'dynamic';
  season_adjustments?: SeasonAdjustment[];
  weekend_adjustment?: number;
  notes?: string | null;
}

export const usePricingRules = () => {
  const { toast } = useToast();

  return useQuery({
    queryKey: ['pricing-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_rules')
        .select('*, properties_real(id, nome, indirizzo, citta)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as (PricingRule & {
        properties_real: { id: string; nome: string; indirizzo: string | null; citta: string | null };
      })[];
    },
    meta: {
      onError: () => {
        toast({
          title: 'Errore',
          description: 'Impossibile caricare le regole di pricing',
          variant: 'destructive',
        });
      },
    },
  });
};

export const usePricingRuleByProperty = (propertyId: string | null) => {
  const { toast } = useToast();

  return useQuery({
    queryKey: ['pricing-rule', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      const { data, error } = await supabase
        .from('pricing_rules')
        .select('*')
        .eq('property_id', propertyId)
        .maybeSingle();

      if (error) throw error;
      return data as PricingRule | null;
    },
    enabled: !!propertyId,
    meta: {
      onError: () => {
        toast({
          title: 'Errore',
          description: 'Impossibile caricare la regola di pricing',
          variant: 'destructive',
        });
      },
    },
  });
};

export const useCreatePricingRule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rule: PricingRuleInsert) => {
      const { data, error } = await supabase
        .from('pricing_rules')
        .insert(rule)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-rules'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-rule'] });
      toast({
        title: 'Regola creata',
        description: 'La regola di pricing e stata salvata',
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Errore',
        description: err.message || 'Impossibile creare la regola di pricing',
        variant: 'destructive',
      });
    },
  });
};

export const useUpdatePricingRule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PricingRuleUpdate }) => {
      const { data, error } = await supabase
        .from('pricing_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-rules'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-rule'] });
      toast({
        title: 'Regola aggiornata',
        description: 'La regola di pricing e stata aggiornata',
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Errore',
        description: err.message || 'Impossibile aggiornare la regola di pricing',
        variant: 'destructive',
      });
    },
  });
};

export const useDeletePricingRule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pricing_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-rules'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-rule'] });
      toast({
        title: 'Regola eliminata',
        description: 'La regola di pricing e stata rimossa',
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Errore',
        description: err.message || 'Impossibile eliminare la regola',
        variant: 'destructive',
      });
    },
  });
};

export function calculateNightPrice(
  rule: PricingRule,
  date: Date
): number {
  let price = rule.base_price;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = date.getDay();

  if (rule.season_adjustments && Array.isArray(rule.season_adjustments)) {
    for (const season of rule.season_adjustments) {
      if (isDateInSeason(month, day, season)) {
        if (season.adjustment_percent) {
          price = price * (1 + season.adjustment_percent / 100);
        }
        if (season.adjustment_fixed) {
          price = price + season.adjustment_fixed;
        }
        break;
      }
    }
  }

  if (rule.weekend_adjustment && (dayOfWeek === 5 || dayOfWeek === 6)) {
    price = price * (1 + rule.weekend_adjustment / 100);
  }

  if (rule.min_price !== null && price < rule.min_price) {
    price = rule.min_price;
  }
  if (rule.max_price !== null && price > rule.max_price) {
    price = rule.max_price;
  }

  return Math.round(price * 100) / 100;
}

function isDateInSeason(
  month: number,
  day: number,
  season: SeasonAdjustment
): boolean {
  const current = month * 100 + day;
  const start = season.start_month * 100 + season.start_day;
  const end = season.end_month * 100 + season.end_day;

  if (start <= end) {
    return current >= start && current <= end;
  }
  return current >= start || current <= end;
}
