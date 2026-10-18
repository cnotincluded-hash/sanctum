import { createClient, type User } from "@supabase/supabase-js";

// The desktop build never calls Supabase: its data stays in Documents/Sanctum.
// The website version uses these public Vite environment variables for account sync.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export type SupabaseUser = User;
