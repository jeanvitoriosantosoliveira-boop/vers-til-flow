import { supabase as configuredSupabase } from "@/integrations/supabase/client";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

export const isSupabaseConfigured = Boolean(url && key);

export const supabase = isSupabaseConfigured ? configuredSupabase : null;