import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type PropertiesReal = Tables<'properties_real'>;
type PropertiesMobile = Tables<'properties_mobile'>;
type PropertiesRealInsert = TablesInsert<'properties_real'>;
type PropertiesMobileInsert = TablesInsert<'properties_mobile'>;

export const usePropertiesReal = () => {
  const { toast } = useToast();
  
  return useQuery({
    queryKey: ['properties-real'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties_real')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    meta: {
      onError: () => {
        toast({
          title: "Errore",
          description: "Impossibile caricare le proprietà immobiliari",
          variant: "destructive",
        });
      },
    },
  });
};

export const usePropertiesMobile = () => {
  const { toast } = useToast();
  
  return useQuery({
    queryKey: ['properties-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties_mobile')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    meta: {
      onError: () => {
        toast({
          title: "Errore",
          description: "Impossibile caricare le proprietà mobili",
          variant: "destructive",
        });
      },
    },
  });
};

export const useCreatePropertyReal = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (property: PropertiesRealInsert) => {
      const { data, error } = await supabase
        .from('properties_real')
        .insert(property)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties-real'] });
      toast({
        title: "Proprietà aggiunta",
        description: "La proprietà immobiliare è stata aggiunta con successo",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiungere la proprietà",
        variant: "destructive",
      });
    },
  });
};

export const useCreatePropertyMobile = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (property: PropertiesMobileInsert) => {
      const { data, error } = await supabase
        .from('properties_mobile')
        .insert(property)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties-mobile'] });
      toast({
        title: "Proprietà aggiunta",
        description: "La proprietà mobile è stata aggiunta con successo",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiungere la proprietà",
        variant: "destructive",
      });
    },
  });
};