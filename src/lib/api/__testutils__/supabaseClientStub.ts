import type { SupabaseClient } from '@supabase/supabase-js';

export const supabase = {
  from() {
    throw new Error('Supabase client stub should not be used directly.');
  },
} as unknown as SupabaseClient;
