import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wupqndwpxyepihnsypxg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cHFuZHdweHllcGlobnN5cHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MjMzNDQsImV4cCI6MjEwMDI5OTM0NH0.o0oz-B7xkqZU1HxbqFYB9yZBz4aXyoAwxCEYDf8EecQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // picks up magic link tokens from the URL
  },
});

export type SupabaseUser = Awaited<
  ReturnType<typeof supabase.auth.getUser>
>["data"]["user"];
