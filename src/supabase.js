import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xdwvfhkzcxutfoqqzoty.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhkd3ZmaGt6Y3h1dGZvcXF6b3R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2NjczMDgsImV4cCI6MjA2OTI0MzMwOH0.vRCE8dYnG5KvVfVH1WdtHmwQpNZI7gek0_jbcbhKtwI'

// Tạo storage key unique cho mỗi tab
const storageKey = `supabase.auth.token.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: storageKey,
    flowType: 'pkce'
  }
})

export default supabase 