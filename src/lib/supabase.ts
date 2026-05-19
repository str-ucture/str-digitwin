import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { validateConfig, isConfigError } from './config'

const config = validateConfig()

// If config is invalid, App.tsx renders ConfigError before Supabase is ever called.
// The empty-string fallback keeps TypeScript happy and prevents a createClient crash
// in the unlikely case this module is imported before the guard runs.
const supabaseUrl = isConfigError(config) ? '' : config.supabaseUrl
const supabaseAnonKey = isConfigError(config) ? '' : config.supabaseAnonKey

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
