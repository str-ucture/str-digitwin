# STR Digital Twin — Developer & Maintainer Guide

This manual details the system architecture, technical dependencies, local environment setup, database migrations, and advanced administrative tools supporting the **STR Digital Twin** web application.

---

## 🛠️ Technology Stack

| Component | Framework / Library | Description |
|---|---|---|
| **Frontend Core** | Vite 5, React 18, TypeScript | High-performance module bundler and reactive component structure. |
| **Styling** | TailwindCSS | Utility-first CSS framework providing premium, responsive UI design tokens. |
| **Mapping Engine** | Mapbox GL JS 3 | Vector maps, custom interactive WebGL layer instances, and 3D terrain/building structures. |
| **3D Rendering** | Three.js / GLTFLoader | Direct glTF/GLB scene generation operating alongside custom WebGL layer synchronizations. |
| **Geometry Pipelines**| `@gltf-transform` | Client-side LOD optimization pipelines (`dedup`, `prune`, `weld`) running entirely inside browser Web Workers. |
| **Database & Auth** | Supabase | PostgreSQL backend powered by PostgREST endpoints, Row Level Security (RLS), and dedicated object storage buckets. |
| **Internationalization**| `react-i18next` | Live application key-value localization mapping supporting English (`en`) and German (`de`). |
| **CI/CD Deployment** | GitHub Actions | Automated build validation and push-triggered deployment to GitHub Pages. |

---

## 🏗️ System Architecture & Codebase Status

The platform architecture decouples high-fidelity WebGL mapping from standard administrative state manipulation. Recent robust platform developments include:

### 1. Global Visibility Control
- Integrated a global `visible` boolean column flag into the core `projects` schema (introduced via migration `007_add_project_visible_column.sql`).
- Admin table switches and update modals allow instant site-wide rendering toggles. Projects marked non-visible are strictly omitted at the Supabase Query hook level (`useProjects`), completely suppressing map footprints, three-dimensional custom models, and sidebar list entries.

### 2. Bidirectional Hover Synchronization
- Achieved pure bidirectional sync between left sidebar `ProjectCard` items and custom Mapbox `Marker` elements via hoisted React state (`hoveredProjectId`).
- Hover triggers instantly scale marker pins to `scale(1.15)` with animated drop shadows and visually highlight sidebar cards, while completely preventing map camera displacement or scroll-pan jitter during continuous user hovering.

### 3. Dynamic Form Coordinate Auto-Parsing
- Administrative location creation interfaces utilize flexible string-type inputs.
- Pasting full coordinate strings copied natively from Google Maps (e.g. `(49.304373, 12.847589)`) triggers regex auto-extraction inside the `Latitude` field handler, instantly updating both `Latitude` and `Longitude` numerical states concurrently.

### 4. Custom WebGL Context Handshake
- Standard Three.js GLB rendering layers share Mapbox GL JS v3's underlying active canvas context.
- Implemented deterministic vertex attribute pointer release bindings and MSAA render target preservation loops (`bindVertexArray(null)` alongside explicit frame buffer restoration) to entirely avoid mutual WebGL state corruption or pipeline freezing.

---

## 📂 Repository Structure

```text
str-digitwin/
├── index.html                    # Root SPA entry file
├── src/
│   ├── components/
│   │   ├── Admin/                # Secure administrative forms, custom toggle groups, data tables
│   │   ├── Map/                  # MapView engine, custom HUD overlays, camera telemetry controls
│   │   ├── ModelProcessor/       # In-browser format conversion (OBJ/FBX/DAE -> GLB), gltf-transform optimization
│   │   ├── ProjectDetail/        # Dynamic drawer rendering photo galleries and GeoJSON overlay items
│   │   ├── Sidebar/              # Responsive project filtering navigation headers and synchronised item cards
│   │   └── UI/                   # Common interactive wrappers, header menus, bilingual switches
│   ├── hooks/                    # Supabase query wrappers (useProjects, useAdminProjects)
│   ├── lib/                      # Mapbox API tokens, Supabase database bindings, auth context singletons
│   └── types/                    # Strongly-typed TypeScript database schema interfaces
├── supabase/
│   └── migrations/               # Sequential PostgreSQL state definitions
└── .github/workflows/            # Continuous Integration workflows for type-checking and automated hosting builds
```

---

## 🗄️ Database Schema & Supabase Migrations

All core relational states, Row Level Security configurations, and bucket storage rules are defined inside sequential SQL files under `supabase/migrations/`. Apply these sequentially inside your production or testing **Supabase SQL Editor**:

1. **`001_initial.sql`**: Bootstraps the primary `projects` table, global read access policies, authenticated write policies, and the `project-images` media bucket.
2. **`002_model_layers.sql`**: Injects JSONB support for dynamic multi-model definitions (`model_layers`) and provisions the public `project-models` repository storage bucket.
3. **`003_add_visibility_flag.sql`**: Added specific layer visibility flags inside embedded JSON schemas.
4. **`004_add_default_camera.sql`**: Introduces default spatial perspectives (`default_camera`) on base projects.
5. **`005_add_hidden_buildings.sql`**: Supports vector building mask arrays (`hidden_building_ids`) enabling users to mask built-in Mapbox baseline structures to place custom models seamlessly.
6. **`006_update_rls_policies.sql`**: Hardens Supabase authentication policies to enforce explicit admin authorization checks.
7. **`007_add_project_visible_column.sql`**: Injects the top-level `visible` default `true` column on the core `projects` table to facilitate global map portfolio suppression.

---

## 💻 Local Development Setup

### 1. Prerequisite Installations
- **Node.js**: Version 20.0.0 or higher.
- **Supabase CLI**: Required if running mock database layers locally (`npm install -g supabase`).

### 2. Dependency Installation
Execute standard installation commands at the workspace root:
```bash
npm install
```

### 3. Environment Variables
Duplicate the example variable file:
```bash
cp .env.example .env.local
```
Populate `.env.local` with authenticated workspace API tokens:
```env
# Mapbox public access key
VITE_MAPBOX_TOKEN=pk.eyJ1Ijoi...

# Production or localized mock Supabase instance details
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# Maintain default single-page path structures locally
VITE_BASE_PATH=/
```

### 4. Running the Development Server
Launch the local auto-reloading Vite server:
```bash
npm run dev
```
Access the client frontend instance at `http://localhost:5173`.

---

## 🔍 Validation Commands

Verify strict static type alignment across complex generic database components and module files:
```bash
npm run type-check
```

Generate the optimized production artifact build bundle locally:
```bash
npm run build
```

Preview compiled production single-page output chunks locally:
```bash
npm run preview
```

---

## 🚀 Deployment Instructions

### Automated GitHub Pages Builds
The project repository contains dedicated `.github/workflows/deploy.yml` directives configured to compile and export static HTML/JS assets whenever code is merged into the `main` tracking branch.

### Configuration Rules
1. **Repository Settings**: Navigate to **Settings → Pages** and configure the build source configuration to point directly to **GitHub Actions**.
2. **Environment Secrets**: Ensure the target GitHub repository contains defined GitHub Actions environment variable credentials matching local parameters (`VITE_MAPBOX_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and correct target sub-path prefix strings inside `VITE_BASE_PATH`).
3. **Token Hardening**: Protect production maps by explicitly setting domain-level URL execution constraints on your provisioned Mapbox developer token to target solely authorized deployment top-level domains.
