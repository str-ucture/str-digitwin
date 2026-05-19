import '../lib/loadEnv'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!serviceRoleKey) {
  console.error(
    '[create-admin] Error: SUPABASE_SERVICE_ROLE_KEY is not set.\n\n' +
    '  Add it to .env as SUPABASE_SERVICE_ROLE_KEY=<value> then re-run.',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@strdigitwin.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ''

if (!ADMIN_PASSWORD) {
  console.error(
    '[create-admin] Error: ADMIN_PASSWORD is not set.\n\n' +
    '  Add it to .env as ADMIN_PASSWORD=<your-secure-password> then re-run.',
  )
  process.exit(1)
}

async function createAdminUser() {
  console.log(`[create-admin] Connecting to Supabase at ${supabaseUrl}`)

  // Check if user already exists
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('[create-admin] Failed to list users:', listError.message)
    process.exit(1)
  }

  const existing = users.find(u => u.email === ADMIN_EMAIL)
  if (existing) {
    console.log(`[create-admin] User ${ADMIN_EMAIL} already exists (id: ${existing.id}) — skipping.`)
    console.log('[create-admin] To reset the password, delete the user and re-run this script.')
    process.exit(0)
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  })

  if (error) {
    console.error('[create-admin] Failed to create user:', error.message)
    process.exit(1)
  }

  console.log(`[create-admin] ✓ Admin user created successfully.`)
  console.log(`[create-admin]   Email: ${data.user.email}`)
  console.log(`[create-admin]   ID:    ${data.user.id}`)
}

createAdminUser()
