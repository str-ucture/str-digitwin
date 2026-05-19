// Manually written to match supabase/migrations/001_initial.sql
// Regenerate with: npm run supabase:types (requires local Supabase running)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Relationships: []
        Row: {
          id: string
          name_en: string
          name_de: string
          description_en: string | null
          description_de: string | null
          type: 'architecture' | 'infrastructure' | 'urban_planning'
          status: 'completed' | 'ongoing' | 'planned'
          client: string | null
          address: string | null
          city: string
          lat: number
          lng: number
          completion_date: string | null
          area_sqm: number | null
          polygon: Json | null
          geojson_layers: Json | null
          model_layers: Json | null
          default_camera: Json | null
          hidden_building_ids: string[] | null
          thumbnail_url: string | null
          image_urls: string[] | null
          tags: string[] | null
          featured: boolean
          visible: boolean
          source_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name_en: string
          name_de: string
          description_en?: string | null
          description_de?: string | null
          type: 'architecture' | 'infrastructure' | 'urban_planning'
          status?: 'completed' | 'ongoing' | 'planned'
          client?: string | null
          address?: string | null
          city?: string
          lat: number
          lng: number
          completion_date?: string | null
          area_sqm?: number | null
          polygon?: Json | null
          geojson_layers?: Json | null
          model_layers?: Json | null
          default_camera?: Json | null
          hidden_building_ids?: string[] | null
          thumbnail_url?: string | null
          image_urls?: string[] | null
          tags?: string[] | null
          featured?: boolean
          visible?: boolean
          source_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name_en?: string
          name_de?: string
          description_en?: string | null
          description_de?: string | null
          type?: 'architecture' | 'infrastructure' | 'urban_planning'
          status?: 'completed' | 'ongoing' | 'planned'
          client?: string | null
          address?: string | null
          city?: string
          lat?: number
          lng?: number
          completion_date?: string | null
          area_sqm?: number | null
          polygon?: Json | null
          geojson_layers?: Json | null
          model_layers?: Json | null
          default_camera?: Json | null
          hidden_building_ids?: string[] | null
          thumbnail_url?: string | null
          image_urls?: string[] | null
          tags?: string[] | null
          featured?: boolean
          visible?: boolean
          source_url?: string | null
          created_at?: string
        }
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
  }
}
