import { createClient, type User } from "@supabase/supabase-js";

// The website signs in and syncs with this Supabase project. The desktop app
// never calls it: its data stays in Documents/Sanctum.
// The anon key is meant to be public (row-level security protects the data).
// To point a build at a different project, set VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY (see .env.example).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://wupqndwpxyepihnsypxg.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cHFuZHdweHllcGlobnN5cHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MjMzNDQsImV4cCI6MjEwMDI5OTM0NH0.o0oz-B7xkqZU1HxbqFYB9yZBz4aXyoAwxCEYDf8EecQ";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // picks up magic-link tokens from the URL
  },
});
export type SupabaseUser = User;
