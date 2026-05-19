/**
 * Reads GEMINI_API_KEY and MAPBOX_TOKEN from .env.local (or .env)
 * and pushes them to Supabase Edge Function secrets via the CLI.
 *
 * Usage: npm run supabase:secrets
 * Requires: supabase CLI logged in (`npx supabase login`)
 */

import { execSync } from 'child_process'
import { resolve } from 'path'
import { config } from 'dotenv'

const root = resolve(process.cwd())

// Load .env.local first, fall back to .env
const result = config({ path: resolve(root, '.env.local') })
if (result.error) {
  config({ path: resolve(root, '.env') })
}

const SECRET_KEYS = ['GEMINI_API_KEY', 'MAPBOX_TOKEN'] as const

const pairs: string[] = []

for (const key of SECRET_KEYS) {
  const value = process.env[key]
  if (value) {
    pairs.push(`${key}=${value}`)
    console.log(`  ✓ ${key} — found`)
  } else {
    console.log(`  ✗ ${key} — not set in .env.local, skipping`)
  }
}

if (pairs.length === 0) {
  console.error('\nNo secrets found. Add GEMINI_API_KEY (and optionally MAPBOX_TOKEN) to .env.local')
  process.exit(1)
}

console.log(`\nPushing ${pairs.length} secret(s) to Supabase…`)
execSync(`npx supabase secrets set ${pairs.join(' ')}`, { stdio: 'inherit' })
console.log('\nDone. Secrets are now available to Edge Functions.')
