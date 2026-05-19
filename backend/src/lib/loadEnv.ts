import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

// Vite uses .env.local as the local override file.
// Node/dotenv defaults to .env, so we have to bridge this explicitly.
// We load .env.local first (highest priority), then .env as fallback.
// Both files are optional — missing files are silently skipped.

const root = resolve(process.cwd())

const envLocal = resolve(root, '.env.local')
const envDefault = resolve(root, '.env')

if (existsSync(envLocal)) {
  config({ path: envLocal })
} else if (existsSync(envDefault)) {
  config({ path: envDefault })
} else {
  console.warn(
    '[env] Warning: no .env.local or .env file found.\n' +
    '      Run: cp .env.example .env.local  and fill in your values.',
  )
}
