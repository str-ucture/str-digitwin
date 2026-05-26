# STR Digital Twin — Project Architecture & Developer Entry Point

This document serves as an architectural entry point for AI agents and human developers. It outlines the codebase layout, data schemas, and critical technical mechanisms.

---

## 🌍 Platform Overview & Technical Stack

**STR Digital Twin** is an interactive 3D map portfolio visualizing architectural, infrastructure, and urban planning projects in Stuttgart, Germany.

*   **Frontend**: React 18, Vite 5, TypeScript, TailwindCSS, React Router v6, `react-i18next` (EN/DE localization).
*   **Mapping & 3D**: Mapbox GL JS v3, Three.js (`three` 0.184.0), `@gltf-transform` (model LOD optimization).
*   **Backend / Database**: Supabase (PostgreSQL, PostgREST, RLS, storage buckets), Node Express server (local-only utility for AI scraping).

---

## 📂 Repository Structure

*   [index.html](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/index.html) — Single-Page App entry point.
*   [src/](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src) — React client application.
    *   [App.tsx](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/App.tsx) — Client router, Auth & config validators.
    *   [components/](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/components) — Sub-system UI components.
        *   [Admin/](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/components/Admin) — Forms ([ProjectForm.tsx](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/components/Admin/ProjectForm.tsx)), search, dialogs, and project grids.
        *   [Map/](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/components/Map) — Map view engine ([MapView.tsx](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/components/Map/MapView.tsx)), search, and settings panels.
        *   [ModelProcessor/](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/components/ModelProcessor) — Model optimization client UI, converters, and GLB uploaders.
        *   [ProjectDetail/](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/components/ProjectDetail) — Photo galleries and detailed slide-out info panels.
        *   [Sidebar/](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/components/Sidebar) — Filters, keyword search, and list item cards.
        *   [UI/](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/components/UI) — Core wrappers (headers, language/locale toggles).
    *   [hooks/](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/hooks) — Supabase endpoints & state query wrappers:
        *   [useProjects.ts](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/hooks/useProjects.ts) — Public project fetcher (strictly filters `visible = true`).
        *   [useAdminProjects.ts](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/hooks/useAdminProjects.ts) — Authed administrator query hook.
    *   [lib/](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/lib) — Singletons and utilities:
        *   [authContext.tsx](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/lib/authContext.tsx) — Session authentication state provider.
        *   [mapbox.ts](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/lib/mapbox.ts) — Styles, theme colors, and font-patching rules.
        *   [supabase.ts](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/lib/supabase.ts) — DB client initialization.
    *   [types/](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/types) — Strongly typed entities:
        *   [project.ts](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/types/project.ts) — Domain model (`Project`, `ModelLayer`, `GeoJSONLayer`, `LayerCamera`).
        *   [database.ts](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/types/database.ts) — Auto-generated Supabase PostgreSQL types.
    *   [pages/](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/pages) — Main route controllers.
        *   [HomePage.tsx](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/pages/HomePage.tsx) — Interactive 3D cityscape map dashboard.
        *   [AdminPage.tsx](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/pages/AdminPage.tsx) — Administrative project data table editor.
        *   [ModelProcessorPage.tsx](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/pages/ModelProcessorPage.tsx) — Multi-format 3D optimization portal.
        *   [ModelViewerPage.tsx](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/pages/ModelViewerPage.tsx) — Geometric and volumetric inspector for models, supporting XLSX semantic exports.
*   [backend/](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/backend) — Server utilities.
    *   [src/routes/scrape.ts](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/backend/src/routes/scrape.ts) — AI auto-scraping endpoint.
*   [supabase/migrations/](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/supabase/migrations) — Sequential SQL database schema definitions.

---

## 🗄️ Database Schema & Key Entities

Primary schema details defined in [001_initial.sql](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/supabase/migrations/001_initial.sql) through [007_add_project_visible_column.sql](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/supabase/migrations/007_add_project_visible_column.sql).

### `projects` Table Definition
*   `id` (uuid): Primary key.
*   `name_en`, `name_de` (text): Localized project title names.
*   `description_en`, `description_de` (text): Localized summaries.
*   `type` (text): `architecture`, `infrastructure`, or `urban_planning`.
*   `status` (text): `completed`, `ongoing`, or `planned`.
*   `lat`, `lng` (double precision): Geospatial anchor coordinates.
*   `polygon` (jsonb): GeoJSON boundary representing the overall project footprint.
*   `geojson_layers` (jsonb - `GeoJSONLayer[]`): Array of multiple individual overlays with separate coordinate reference conversions and camera angles.
*   `model_layers` (jsonb - `ModelLayer[]`): Placed 3D models specifying public glTF/GLB url paths, scale, translation offsets, custom local-to-world offsets, rotation bounds, and multiple preset layer cameras.
*   `default_camera` (jsonb - `LayerCamera`): Set camera location (zoom, pitch, bearing, center).
*   `hidden_building_ids` (text[]): Mapbox structural building identifiers hidden to allow overlays.
*   `visible` (boolean): Default `true`. If set `false`, the project is hidden from public UI.
*   `source_url` (text): Reference URL scraped to auto-populate metadata.

---

## ⚙️ Core Technical Mechanisms & Handshakes

### 1. Custom WebGL Layer Sharing (Mapbox + Three.js)
To avoid canvas context corruption, custom rendering coordinates map onto Mapbox GL's active WebGL context within [MapView.tsx](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/components/Map/MapView.tsx).
*   **Handshake**: A separate `THREE.WebGLRenderer` is initialized per model layer with `autoClear = false` and reuse of the Mapbox canvas context (`gl`).
*   **State Reset**: At the end of each model render block:
    *   Call `threeRenderer.resetState()` to align states.
    *   Unbind Mapbox and Three.js VAOs via standard WebGL context methods `rawGl.bindVertexArray?.(null)` to prevent attribute collision or frame freezes.

### 2. Bidirectional Hover Synchronization
Left sidebar project list items [ProjectCard.tsx](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/components/Sidebar/ProjectCard.tsx) and Mapbox markers sync in real-time.
*   Shared context is maintained via `hoveredProjectId` in [HomePage.tsx](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/pages/HomePage.tsx).
*   Hovering raises scaling to `scale(1.15)` and applies active drop shadows without map camera displacement, ensuring stability.

### 3. Coordinate System Reference Offset Conversions
Geometries inside [HomePage.tsx](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/pages/HomePage.tsx) dynamically project coordinate ranges.
*   **Meter-to-Degree transformation**: When a project layer specifies coordinate bounds in `meters`, standard geospatial translations (`shiftCoords`, `applyCoordRef`) convert coordinates relative to the project center anchor into WGS84 degrees, enabling precise layout overlay alignment.

### 4. AI Scraping Route (`POST /api/scrape-project`)
Allows admins to import projects by pasting a web link into [ProjectForm.tsx](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/components/Admin/ProjectForm.tsx).
*   **Step A**: Scraping endpoint in [scrape.ts](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/backend/src/routes/scrape.ts) sends the target URL to Jina Reader API to get a simplified Markdown page.
*   **Step B**: Markdown is sent to Gemini 2.5 Flash (`gemini-2.5-flash`) via structural JSON parsing configuration.
*   **Step C**: Extracted images are downloaded, normalized with `sharp` to optimized WebP formats, and uploaded to Supabase's `project-images` bucket.
*   **Step D**: Coordinates are retrieved by querying Mapbox's geocoding endpoint for the extracted street address/city.

### 5. In-Browser 3D Model Optimization
Enables optimization of models in [ModelProcessorPage.tsx](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/pages/ModelProcessorPage.tsx) prior to cloud uploading.
*   Converts source formats (OBJ/FBX/DAE) to GLB locally.
*   Uses `@gltf-transform` pipelines (`prune`, `weld`, `dedup`) executed asynchronously via Web Workers to keep UI threads responsive.

### 6. Volumetric Analysis & Excel Sync
Admin panel model inspection in [ModelViewerPage.tsx](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/src/pages/ModelViewerPage.tsx) performs complex geometry actions:
*   **Volumetric Math**: Scans 3D model node structures and computes actual dimensions and mesh volume indices based on face vectors.
*   **Virtualization**: TanStack Virtual is utilized to map complex hierarchies smoothly without performance drops.
*   **Excel Sync**: Imports/exports scene metrics and BIM metadata using SheetJS (`xlsx`).

---

## 🚀 Local Developer Command Reference

Ensure Node.js v20+ and copy `.env.example` as `.env.local` with proper Supabase & Mapbox keys.

*   `npm install` — Installs project-wide requirements.
*   `npm run dev` — Launches concurrently the Vite builder and Express scraper server.
*   `npm run build` — Bundles static build files into `dist/`.
*   `npm run type-check` — Performs global TypeScript compilations for client and backend.
*   `npm run seed` — Runs database seed inserts ([seed.ts](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/backend/src/scripts/seed.ts)).
*   `npm run create-admin` — Creates authentication profiles to log into admin pages ([create-admin-user.ts](file:///C:/Users/ShaileshShrestha/Desktop/str-digitwin/backend/src/scripts/create-admin-user.ts)).
