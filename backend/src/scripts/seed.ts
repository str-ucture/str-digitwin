import '../lib/loadEnv'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!serviceRoleKey) {
  console.error(
    '[seed] Error: SUPABASE_SERVICE_ROLE_KEY is not set.\n\n' +
    '  For online Supabase: copy the service_role key from Settings → API → service_role\n' +
    '  For local Supabase:  copy the key printed by `npm run supabase:start`\n' +
    '  Add it to .env as SUPABASE_SERVICE_ROLE_KEY=<value> then re-run `npm run seed`',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const SAMPLE_PROJECTS = [
  {
    name_en: 'Rosenstein Residential Quarter',
    name_de: 'Wohnquartier Rosenstein',
    description_en:
      'A mixed-use residential development on the former railway lands north of Stuttgart city centre, featuring 280 apartments across six buildings with integrated green spaces and underground parking.',
    description_de:
      'Ein gemischt genutztes Wohnquartier auf den ehemaligen Bahnflächen nördlich der Stuttgarter Innenstadt mit 280 Wohnungen in sechs Gebäuden, integrierten Grünflächen und Tiefgarage.',
    type: 'architecture',
    status: 'completed',
    client: 'Stadtentwicklung Stuttgart GmbH',
    address: 'Rosensteinstraße 12',
    city: 'Stuttgart',
    lat: 48.7996,
    lng: 9.1931,
    completion_date: '2023-06-15',
    area_sqm: 22400,
    featured: true,
    tags: ['residential', 'mixed-use', 'green-spaces'],
    thumbnail_url: null,
    image_urls: [],
    polygon: null,
  },
  {
    name_en: 'Feuerbach Plaza Redesign',
    name_de: 'Neugestaltung Stadtplatz Feuerbach',
    description_en:
      'Complete redesign of the central public plaza in Feuerbach district, introducing pedestrian-first surfaces, urban greenery, seating areas, and improved accessibility throughout.',
    description_de:
      'Komplette Neugestaltung des zentralen öffentlichen Platzes im Stadtteil Feuerbach mit fußgängerfreundlichen Flächen, urbanem Grün, Sitzbereichen und verbesserter Barrierefreiheit.',
    type: 'urban_planning',
    status: 'completed',
    client: 'Landeshauptstadt Stuttgart – Stadtplanungsamt',
    address: 'Stuttgarter Straße 45',
    city: 'Stuttgart-Feuerbach',
    lat: 48.8018,
    lng: 9.1547,
    completion_date: '2021-09-30',
    area_sqm: 4800,
    featured: false,
    tags: ['public-space', 'pedestrian', 'accessibility'],
    thumbnail_url: null,
    image_urls: [],
    polygon: null,
  },
  {
    name_en: 'Vaihingen Office Campus',
    name_de: 'Bürokomplex Vaihingen',
    description_en:
      'A four-building office campus for a tech company in Stuttgart-Vaihingen with a total floor area of 18,000 m², featuring a central atrium, rooftop terraces, and LEED Gold certification.',
    description_de:
      'Ein viergebäudiger Bürokomplex für ein Technologieunternehmen in Stuttgart-Vaihingen mit einer Gesamtnutzfläche von 18.000 m², zentralem Atrium, Dachterrassen und LEED-Gold-Zertifizierung.',
    type: 'architecture',
    status: 'completed',
    client: 'TechHub Vaihingen AG',
    address: 'Böblinger Straße 220',
    city: 'Stuttgart-Vaihingen',
    lat: 48.7388,
    lng: 9.1058,
    completion_date: '2024-03-01',
    area_sqm: 18000,
    featured: true,
    tags: ['office', 'sustainable', 'LEED'],
    thumbnail_url: null,
    image_urls: [],
    polygon: null,
  },
  {
    name_en: 'North Tram Extension',
    name_de: 'Straßenbahn Erweiterung Nord',
    description_en:
      "Extension of Stuttgart's tram network by 4.2 km through the northern districts, including two new stations, modernised track beds, and upgraded signalling infrastructure.",
    description_de:
      'Verlängerung des Stuttgarter Straßenbahnnetzes um 4,2 km durch die nördlichen Stadtteile, einschließlich zwei neuer Haltestellen, modernisierter Gleisbetten und erneuerter Signalanlagen.',
    type: 'infrastructure',
    status: 'completed',
    client: 'Stuttgarter Straßenbahnen AG (SSB)',
    address: 'Pragstraße',
    city: 'Stuttgart-Nord',
    lat: 48.8012,
    lng: 9.1852,
    completion_date: '2022-11-18',
    area_sqm: null,
    featured: false,
    tags: ['transport', 'tram', 'public-transit'],
    thumbnail_url: null,
    image_urls: [],
    polygon: null,
  },
  {
    name_en: 'Bad Cannstatt Neckar Bridge',
    name_de: 'Neckarbrücke Bad Cannstatt',
    description_en:
      'New multi-use bridge spanning the Neckar river at Bad Cannstatt, combining a two-lane road deck with a separated cycle lane and pedestrian walkway. Currently under construction.',
    description_de:
      'Neue Mehrzweckbrücke über den Neckar in Bad Cannstatt, die eine zweispurige Fahrbahn mit separatem Radweg und Fußgängerweg kombiniert. Derzeit im Bau.',
    type: 'infrastructure',
    status: 'ongoing',
    client: 'Regierungspräsidium Stuttgart',
    address: 'Neckardamm',
    city: 'Stuttgart-Bad Cannstatt',
    lat: 48.8024,
    lng: 9.2162,
    completion_date: null,
    area_sqm: null,
    featured: false,
    tags: ['bridge', 'cycling', 'pedestrian'],
    thumbnail_url: null,
    image_urls: [],
    polygon: null,
  },
]

async function seed() {
  console.log(`[seed] Connecting to Supabase at ${supabaseUrl}`)
  console.log('[seed] Seeding sample projects...')

  const { error: deleteError } = await supabase
    .from('projects')
    .delete()
    .in('name_en', SAMPLE_PROJECTS.map((p) => p.name_en))

  if (deleteError) {
    console.warn('[seed] Warning during cleanup:', deleteError.message)
  }

  const { data, error } = await supabase.from('projects').insert(SAMPLE_PROJECTS).select()

  if (error) {
    if (error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
      console.error(
        '[seed] Error: Could not connect to Supabase.\n\n' +
        '  Make sure local Supabase is running:\n' +
        '    npm run supabase:start\n\n' +
        '  Then re-run: npm run seed',
      )
    } else {
      console.error('[seed] Insert failed:', error.message)
    }
    process.exit(1)
  }

  console.log(`[seed] ✓ Inserted ${data.length} projects successfully.`)
  const studioHint = supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('localhost')
    ? '  View them in local Supabase Studio: http://localhost:54323'
    : `  View them at: ${supabaseUrl.replace('/rest/v1', '')}/project/default/editor`
  console.log(`[seed] ${studioHint}`)
}

seed()
