import type { Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const MAX_IMAGES = 5
const MAX_DIMENSION = 1920
const WEBP_QUALITY = 90

interface GeminiExtracted {
  name_en: string | null
  name_de: string | null
  description_en: string | null
  description_de: string | null
  type: 'architecture' | 'infrastructure' | 'urban_planning' | null
  status: 'completed' | 'ongoing' | 'planned' | null
  client: string | null
  address: string | null
  city: string | null
  completion_date: string | null
  area_sqm: number | null
  tags: string[]
  image_urls: string[]
}

async function fetchPageContent(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`
  const res = await fetch(jinaUrl, {
    headers: {
      'Accept': 'text/plain',
      'X-Return-Format': 'markdown',
      'X-With-Images-Summary': 'true',
    },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Jina Reader returned ${res.status}`)
  return res.text()
}

async function extractWithGemini(markdown: string, sourceUrl: string): Promise<GeminiExtracted> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in .env.local')

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

  const systemInstruction = `You are a data extraction assistant for an architecture firm's project database.
Extract structured project information from the provided webpage content and return it as valid JSON.
The firm is German-speaking (str.ucture), so German text on the page is likely the primary language.
For English fields, translate German content accurately. For German fields, keep original German text.`

  const userPrompt = `Extract project information from this architecture firm webpage content.

Source URL: ${sourceUrl}

Webpage content (markdown):
---
${markdown.slice(0, 28_000)}
---

Return a JSON object with EXACTLY these fields (use null for any field you cannot determine with confidence):
{
  "name_en": "Project name in English (translate if German)",
  "name_de": "Project name in German (original or translate from English)",
  "description_en": "2-4 sentence project description in English. Be concise and factual.",
  "description_de": "2-4 sentence project description in German. Be concise and factual.",
  "type": "architecture" or "infrastructure" or "urban_planning" or null,
  "status": "completed" or "ongoing" or "planned" or null,
  "client": "Client or commissioner name, or null",
  "address": "Street address of the project location (NOT the firm office address), or null",
  "city": "City where the project is located, or null",
  "completion_date": "YYYY-MM-DD if year is known (use YYYY-01-01 if only year available), or null",
  "area_sqm": numeric area in square meters as a number (convert if m² mentioned), or null,
  "tags": ["lowercase", "english", "tags", "max 8", "relevant to project"],
  "image_urls": ["direct image file URLs only", "ending in .jpg/.jpeg/.png/.webp", "max 10", "prefer large project photos", "EXCLUDE icons/logos/navigation images"]
}

Classification rules:
- type: architecture = buildings/renovation/structures; infrastructure = roads/bridges/utilities/engineering; urban_planning = city planning/public space/landscape
- status: completed = finished project; ongoing = under construction/in progress; planned = future/concept/competition
- tags: lowercase English terms (e.g. "residential", "museum", "concrete", "renovation", "mixed-use")
- image_urls: only direct file URLs (http...jpg/png/webp), not page links or data URIs

Return ONLY the JSON object, no markdown code fences, no explanation.`

  const body = {
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 300)}`)
  }

  const json = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  try {
    return JSON.parse(text) as GeminiExtracted
  } catch {
    throw new Error('Gemini returned invalid JSON')
  }
}

async function downloadAndUploadImages(
  imageUrls: string[],
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<string[]> {
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
  const results: string[] = []

  for (const url of imageUrls.slice(0, MAX_IMAGES)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
      if (!res.ok) continue

      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.startsWith('image/')) continue

      const buffer = Buffer.from(await res.arrayBuffer())

      // Resize to max 1920px on longest side, convert to WebP — matches browser-side processImage()
      const webpBuffer = await sharp(buffer)
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer()

      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
      const { error: uploadError } = await supabaseAdmin.storage
        .from('project-images')
        .upload(path, webpBuffer, { contentType: 'image/webp' })

      if (uploadError) continue

      const { data } = supabaseAdmin.storage.from('project-images').getPublicUrl(path)
      results.push(data.publicUrl)
    } catch {
      // skip failed images, continue with rest
    }
  }

  return results
}

async function geocodeAddress(
  address: string,
  city: string | null,
): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.VITE_MAPBOX_TOKEN ?? process.env.MAPBOX_TOKEN
  if (!token) return null

  const query = [address, city].filter(Boolean).join(', ')
  const encoded = encodeURIComponent(query)
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&limit=1&types=address,place&language=de,en`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const json = await res.json() as { features?: { center?: [number, number] }[] }
    const feature = json.features?.[0]
    if (!feature?.center) return null
    const [lng, lat] = feature.center
    return { lat, lng }
  } catch {
    return null
  }
}

export async function handleScrapeProject(req: Request, res: Response): Promise<void> {
  const { url } = req.body as { url?: string }

  if (!url || !url.startsWith('http')) {
    res.json({ ok: false, error: 'A valid URL starting with http is required' })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  if (!supabaseUrl || !serviceRoleKey) {
    res.json({ ok: false, error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env.local' })
    return
  }

  let partial = false

  // Stage 1: fetch page content via Jina Reader
  let markdown: string
  try {
    markdown = await fetchPageContent(url)
  } catch (e) {
    res.json({ ok: false, error: `Failed to fetch page: ${(e as Error).message}` })
    return
  }

  // Stage 2: extract structured fields with Gemini
  let geminiData: GeminiExtracted
  try {
    geminiData = await extractWithGemini(markdown, url)
  } catch (e) {
    res.json({ ok: false, error: `AI extraction failed: ${(e as Error).message}` })
    return
  }

  // Stage 3: download, process and upload images (non-fatal)
  let uploadedImageUrls: string[] = []
  if (Array.isArray(geminiData.image_urls) && geminiData.image_urls.length > 0) {
    try {
      uploadedImageUrls = await downloadAndUploadImages(geminiData.image_urls, supabaseUrl, serviceRoleKey)
    } catch {
      partial = true
    }
  }

  // Stage 4: geocode address → lat/lng (non-fatal)
  let lat: number | null = null
  let lng: number | null = null
  if (geminiData.address) {
    try {
      const coords = await geocodeAddress(geminiData.address, geminiData.city ?? null)
      if (coords) { lat = coords.lat; lng = coords.lng }
    } catch {
      partial = true
    }
  }

  res.json({
    ok: true,
    partial,
    data: {
      name_en: geminiData.name_en ?? null,
      name_de: geminiData.name_de ?? null,
      description_en: geminiData.description_en ?? null,
      description_de: geminiData.description_de ?? null,
      type: geminiData.type ?? null,
      status: geminiData.status ?? null,
      client: geminiData.client ?? null,
      address: geminiData.address ?? null,
      city: geminiData.city ?? null,
      lat,
      lng,
      completion_date: geminiData.completion_date ?? null,
      area_sqm: geminiData.area_sqm ?? null,
      tags: Array.isArray(geminiData.tags) ? geminiData.tags : [],
      image_urls: uploadedImageUrls,
      source_url: url,
    },
  })
}
