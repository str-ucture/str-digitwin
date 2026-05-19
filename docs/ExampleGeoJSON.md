# GeoJSON Polygon Examples

A GeoJSON Polygon uses `[longitude, latitude]` coordinate pairs. The first and last coordinate must be identical to close the ring. Coordinates go counter-clockwise for exterior rings.

---

## 1. Simple Square (Small Area)

A basic 4-corner square. Good for testing that your upload works at all.

```json
{
  "type": "Feature",
  "properties": {
    "name": "Simple Square"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [0.0, 0.0],
        [1.0, 0.0],
        [1.0, 1.0],
        [0.0, 1.0],
        [0.0, 0.0]
      ]
    ]
  }
}
```

---

## 2. Rectangle (Bounding Box Style)

A landscape-oriented rectangle — useful as a site boundary approximation.

```json
{
  "type": "Feature",
  "properties": {
    "name": "Rectangle Boundary"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [85.3000, 27.6800],
        [85.3500, 27.6800],
        [85.3500, 27.7100],
        [85.3000, 27.7100],
        [85.3000, 27.6800]
      ]
    ]
  }
}
```

---

## 3. Triangle

A 3-point polygon. Minimum valid polygon shape.

```json
{
  "type": "Feature",
  "properties": {
    "name": "Triangle Zone"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [85.3100, 27.6900],
        [85.3300, 27.6900],
        [85.3200, 27.7100],
        [85.3100, 27.6900]
      ]
    ]
  }
}
```

---

## 4. Irregular Pentagon (Building Footprint Style)

5 vertices with irregular spacing — closer to a real building or plot footprint.

```json
{
  "type": "Feature",
  "properties": {
    "name": "Building Footprint A",
    "building_type": "warehouse"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [85.3120, 27.6920],
        [85.3160, 27.6915],
        [85.3175, 27.6940],
        [85.3150, 27.6960],
        [85.3110, 27.6945],
        [85.3120, 27.6920]
      ]
    ]
  }
}
```

---

## 5. Real-World City Block (Kathmandu Area)

A realistic city block polygon with 8 vertices and meaningful properties.

```json
{
  "type": "Feature",
  "properties": {
    "name": "Thamel Block",
    "city": "Kathmandu",
    "district": "Kathmandu",
    "land_use": "commercial",
    "area_sqm": 4200
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [85.3083, 27.7153],
        [85.3095, 27.7149],
        [85.3102, 27.7158],
        [85.3110, 27.7163],
        [85.3107, 27.7172],
        [85.3094, 27.7176],
        [85.3082, 27.7169],
        [85.3078, 27.7160],
        [85.3083, 27.7153]
      ]
    ]
  }
}
```

---

## 6. Polygon with a Hole (Donut Shape)

The first array is the outer ring; the second is the inner ring (hole). Useful for plots with courtyards, water bodies with islands, or exclusion zones.

```json
{
  "type": "Feature",
  "properties": {
    "name": "Courtyard Building",
    "description": "Outer boundary with inner courtyard hole"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [85.3200, 27.7000],
        [85.3250, 27.7000],
        [85.3250, 27.7040],
        [85.3200, 27.7040],
        [85.3200, 27.7000]
      ],
      [
        [85.3215, 27.7010],
        [85.3235, 27.7010],
        [85.3235, 27.7030],
        [85.3215, 27.7030],
        [85.3215, 27.7010]
      ]
    ]
  }
}
```

---

## 7. FeatureCollection with Multiple Polygons

Multiple polygons grouped into a single upload-ready collection — this is the most common format for project uploads.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "zone_id": "Z-01",
        "zone_type": "residential"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [85.3050, 27.6950],
            [85.3100, 27.6950],
            [85.3100, 27.7000],
            [85.3050, 27.7000],
            [85.3050, 27.6950]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "zone_id": "Z-02",
        "zone_type": "industrial"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [85.3110, 27.6950],
            [85.3170, 27.6950],
            [85.3170, 27.7010],
            [85.3110, 27.7010],
            [85.3110, 27.6950]
          ]
        ]
      }
    }
  ]
}
```

---

## 8. Curved-Edge Approximation (High-Vertex Polygon)

Curves don't exist in GeoJSON — you approximate them with many close vertices. This example approximates a circle (16-point regular polygon).

```json
{
  "type": "Feature",
  "properties": {
    "name": "Circular Zone (approximated)",
    "radius_m": 200
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [85.3200, 27.7050],
        [85.3211, 27.7043],
        [85.3218, 27.7031],
        [85.3218, 27.7019],
        [85.3211, 27.7007],
        [85.3200, 27.7000],
        [85.3189, 27.7007],
        [85.3182, 27.7019],
        [85.3182, 27.7031],
        [85.3189, 27.7043],
        [85.3200, 27.7050]
      ]
    ]
  }
}
```

---

## 9. Complex Site with Multiple Holes and Rich Properties

A large site boundary (outer ring) with two exclusion holes (restricted access zones) and detailed metadata properties.

```json
{
  "type": "Feature",
  "properties": {
    "project_id": "PRJ-2026-001",
    "project_name": "Hetauda Industrial Corridor",
    "status": "active",
    "phase": 2,
    "area_ha": 85.4,
    "owner": "DGIDC",
    "start_date": "2025-01-15",
    "completion_date": "2027-06-30",
    "land_use": "industrial",
    "elevation_m": 485,
    "tags": ["SEZ", "infrastructure", "phase-2"]
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [85.0320, 27.4100],
        [85.0420, 27.4095],
        [85.0500, 27.4115],
        [85.0540, 27.4160],
        [85.0530, 27.4220],
        [85.0490, 27.4260],
        [85.0430, 27.4275],
        [85.0360, 27.4265],
        [85.0300, 27.4230],
        [85.0280, 27.4175],
        [85.0300, 27.4130],
        [85.0320, 27.4100]
      ],
      [
        [85.0370, 27.4150],
        [85.0395, 27.4148],
        [85.0395, 27.4168],
        [85.0370, 27.4170],
        [85.0370, 27.4150]
      ],
      [
        [85.0430, 27.4200],
        [85.0460, 27.4198],
        [85.0462, 27.4220],
        [85.0430, 27.4222],
        [85.0430, 27.4200]
      ]
    ]
  }
}
```

---

## 10. Full Project Upload FeatureCollection (Production-Ready)

A complete, realistic FeatureCollection with mixed zone types, nested property objects, and multi-hole polygons — structured for a real digital twin project upload.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "site-boundary",
        "name": "Master Site Boundary",
        "layer": "boundary",
        "metadata": {
          "surveyed_by": "Survey Department Nepal",
          "survey_date": "2025-11-10",
          "crs": "WGS84",
          "accuracy_m": 0.5
        }
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [85.3000, 27.6850],
            [85.3200, 27.6840],
            [85.3350, 27.6880],
            [85.3400, 27.6960],
            [85.3380, 27.7060],
            [85.3280, 27.7120],
            [85.3130, 27.7130],
            [85.3000, 27.7090],
            [85.2930, 27.7010],
            [85.2940, 27.6920],
            [85.3000, 27.6850]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "zone-residential-01",
        "name": "Residential Zone A",
        "layer": "zoning",
        "zone_code": "R1",
        "max_floors": 4,
        "plot_coverage_pct": 60,
        "status": "approved"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [85.3020, 27.6880],
            [85.3100, 27.6875],
            [85.3110, 27.6940],
            [85.3025, 27.6945],
            [85.3020, 27.6880]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "zone-green-01",
        "name": "Central Park with Pond",
        "layer": "green_space",
        "zone_code": "OS1",
        "maintained_by": "Municipality",
        "has_water_body": true
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [85.3140, 27.6960],
            [85.3220, 27.6955],
            [85.3230, 27.7020],
            [85.3145, 27.7025],
            [85.3140, 27.6960]
          ],
          [
            [85.3160, 27.6975],
            [85.3195, 27.6973],
            [85.3197, 27.6998],
            [85.3162, 27.7000],
            [85.3160, 27.6975]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "zone-commercial-01",
        "name": "Commercial Hub",
        "layer": "zoning",
        "zone_code": "C2",
        "max_floors": 10,
        "parking_required": true,
        "fsi": 3.5,
        "status": "under_review"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [85.3240, 27.6980],
            [85.3330, 27.6975],
            [85.3340, 27.7050],
            [85.3250, 27.7055],
            [85.3240, 27.6980]
          ]
        ]
      }
    }
  ]
}
```

---

## Quick Reference

| Example | Vertices | Has Hole | Type | Complexity |
|---|---|---|---|---|
| 1. Simple Square | 4 | No | Polygon | Minimal |
| 2. Rectangle | 4 | No | Polygon | Minimal |
| 3. Triangle | 3 | No | Polygon | Minimal |
| 4. Pentagon | 5 | No | Polygon | Low |
| 5. City Block | 8 | No | Polygon | Low |
| 6. Donut Shape | 4 + 4 | Yes (1) | Polygon | Medium |
| 7. Multi-Zone | 4 + 4 | No | FeatureCollection | Medium |
| 8. Circular Approx | 10 | No | Polygon | Medium |
| 9. Industrial Site | 11 + 4 + 4 | Yes (2) | Polygon + metadata | High |
| 10. Full Project | Mixed | Yes | FeatureCollection | Production |

> **Tip:** Use [geojson.io](https://geojson.io) to paste any example above and visualize it on a map before uploading.
