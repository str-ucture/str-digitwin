import './lib/loadEnv'
import express from 'express'
import { handleScrapeProject } from './routes/scrape'

const PORT = process.env.PORT ?? 3001

const app = express()

app.use(express.json())

// Allow requests from the Vite dev server (any origin is fine for local-only use)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.sendStatus(204); return }
  next()
})

app.post('/api/scrape-project', handleScrapeProject)

app.listen(PORT, () => {
  console.log(`[backend] running on http://localhost:${PORT}`)
  console.log(`[backend] POST /api/scrape-project  — AI project import`)
})
