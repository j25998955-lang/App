import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://qhdexgxiuskzlrubltuy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoZGV4Z3hpdXNremxydWJsdHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3MDQxODYsImV4cCI6MjA3MzI4MDE4Nn0.KGYXYNzJViaRpTJ9YF4yRV59VgBawonm4NZ8ZsemwuQ';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Error Crítico: Faltan las credenciales de Supabase.");
    alert("CRÍTICO: La configuración de Supabase está incompleta. La aplicación no puede funcionar.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
