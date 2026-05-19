// Validates all required environment variables at runtime.
// Called once in App.tsx — renders a setup screen instead of the app if any are missing.

export interface AppConfig {
  mapboxToken: string
  supabaseUrl: string
  supabaseAnonKey: string
}

export interface ConfigValidationError {
  missing: Array<{ key: string; description: string }>
}

const REQUIRED_VARS = [
  {
    key: 'VITE_MAPBOX_TOKEN',
    get value() { return import.meta.env.VITE_MAPBOX_TOKEN as string | undefined },
    description: 'Mapbox GL JS access token (get from account.mapbox.com → Tokens)',
  },
  {
    key: 'VITE_SUPABASE_URL',
    get value() { return import.meta.env.VITE_SUPABASE_URL as string | undefined },
    description: 'Supabase project URL (Settings → API → Project URL)',
  },
  {
    key: 'VITE_SUPABASE_ANON_KEY',
    get value() { return import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined },
    description: 'Supabase anon/public key (Settings → API → anon key)',
  },
]

export function validateConfig(): AppConfig | ConfigValidationError {
  const missing = REQUIRED_VARS.filter((v) => !v.value?.trim()).map((v) => ({
    key: v.key,
    description: v.description,
  }))

  if (missing.length > 0) return { missing }

  return {
    mapboxToken: import.meta.env.VITE_MAPBOX_TOKEN as string,
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  }
}

export function isConfigError(result: AppConfig | ConfigValidationError): result is ConfigValidationError {
  return 'missing' in result
}
