# STR Digital Twin

An interactive 3D map portfolio website showcasing completed architecture, infrastructure, and urban planning projects in and around Stuttgart, Germany. Built for public access — no login required.

---

## 🌍 Platform Overview

STR Digital Twin bridges geographic information systems (GIS) with high-fidelity architectural presentation. Users can interactively explore real project footprints, high-resolution media galleries, and dynamic 3D structural representations embedded directly within a state-of-the-art digital cityscape.

---

## ✨ Key End-User Features

- **Immersive 3D City Map**: Full-screen interactive map powered by Mapbox GL JS, featuring live building extrusions, accurate topographic styling, and fluid spatial navigation.
- **Color-Coded Visual Categories**: Easily distinguish project scopes at a glance:
  - 🔵 **Architecture** (Blue)
  - 🟢 **Infrastructure** (Green)
  - 🟣 **Urban Planning** (Purple)
- **Synced Interactive Navigation**: Hovering over project cards in the left sidebar instantly highlights corresponding markers on the map, and vice versa, providing seamless contextual awareness.
- **Rich Project Detail Panel**: Selecting any project reveals a beautiful sliding panel equipped with full media photo galleries, detailed project metadata, commissioning client details, and geometric overlay toggle switches.
- **Multilayer Inspection**: Seamlessly switch between base boundaries, detailed GeoJSON polygon boundaries, and custom photorealistic 3D model structures directly inside the project HUD.
- **Adaptive Filtering & Search**: Narrow down visible projects instantly using responsive keyword search, specific scope categories, current construction status (completed, ongoing, planned), or completion years.
- **Bilingual Interface**: Native support for both German and English language preferences, including automatic initial browser locale detection and a manual instant header switch control.

---

## 🧭 How to Navigate

1. **Exploring the Map**: Left-click and drag to pan across Stuttgart. Right-click and drag (or hold `Ctrl` + left-click drag) to adjust the pitch and rotation of the 3D perspective view.
2. **Browsing Projects**: Scroll through the project catalog on the left sidebar. Click any card to automatically fly the map camera directly to that project's focal point.
3. **Switching Layers**: Once a project is selected, use the built-in layer HUD controls at the top of the screen to transition between custom spatial views and pre-saved optimal camera angles.
4. **Global View Reset**: Click the custom home reset button located at the top right of the project sidebar to instantly re-center the application to its standard optimized Stuttgart map extent.

---

## 👨‍💻 For Developers & System Administrators

If you are looking to set up the codebase locally, provision database tables via Supabase migrations, process 3D models using the integrated Three.js pipeline, or deploy the platform to production hosting, please consult the dedicated technical manual:

👉 **[Developer & Maintainer Guide](./DEVELOPER_GUIDE.md)**
