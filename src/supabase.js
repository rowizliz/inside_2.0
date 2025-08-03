import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xdwvfhkzcxutfoqqzoty.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhkd3ZmaGt6Y3h1dGZvcXF6b3R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2NjczMDgsImV4cCI6MjA2OTI0MzMwOH0.vRCE8dYnG5KvVfVH1WdtHmwQpNZI7gek0_jbcbhKtwI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    // Bật xử lý token từ URL để hỗ trợ recovery/reset password
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'inside-app-auth'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

export default supabase