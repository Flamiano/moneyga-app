import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const supabaseUrl = "https://bhryngilrtrvxixfxzql.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJocnluZ2lscnRydnhpeGZ4enFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MzU2MTQsImV4cCI6MjA4MjMxMTYxNH0.SDnwHieWZdookN6XN6jMxGCjdk5QFDvf-wSYSNpQyGU";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
