import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Supabase Configuration
const SUPABASE_URL = 'https://cubnpddinqtubsptdipi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1Ym5wZGRpbnF0dWJzcHRkaXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NDA2MDMsImV4cCI6MjA3MTQxNjYwM30.Gy4XS-Br-DO8nl4Wq_qHhp2A9gd38raRvTokuqdfKqo';

// Initialize and export Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configuration constants
export const CONFIG = {
  ITEMS_PER_PAGE: 20,
  NOTIFICATION_TIMEOUT: 5000,
  DEBOUNCE_DELAY: 300,
  REALTIME_RECONNECT_DELAY: 1000
};
