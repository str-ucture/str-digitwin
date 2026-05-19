import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import mapboxgl from 'mapbox-gl'
import { mapInstanceRef } from '../../lib/mapContext'
import { MAPBOX_TOKEN } from '../../lib/mapbox'

interface GeocodingFeature {
  id: string
  place_name: string
  center: [number, number]
  bbox?: [number, number, number, number]
}

export default function LocationSearchBar() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodingFeature[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const justSelectedRef = useRef(false)

  // Clear temporary debug marker from the map
  const clearMarker = useCallback(() => {
    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
  }, [])

  // Execute Mapbox Geocoding API search
  const searchLocation = useCallback(async (searchStr: string) => {
    if (!searchStr.trim() || !MAPBOX_TOKEN) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    try {
      const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        searchStr
      )}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5`

      const response = await fetch(endpoint)
      if (!response.ok) throw new Error('Geocoding request failed')

      const data = await response.json()
      setResults(data.features || [])
      setSelectedIndex(-1)
    } catch (err) {
      console.warn('[LocationSearchBar] Search error:', err)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounce input changes
  useEffect(() => {
    // If query changed because the user just clicked an option, skip searching/reopening
    if (justSelectedRef.current) {
      justSelectedRef.current = false
      return
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    if (query.trim()) {
      setIsOpen(true)
      debounceTimeoutRef.current = setTimeout(() => {
        searchLocation(query)
      }, 300)
    } else {
      setResults([])
      setIsOpen(false)
      clearMarker()
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [query, searchLocation, clearMarker])

  // Handle outside clicks to close the dropdown and collapse width
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Clean up marker on unmount
  useEffect(() => {
    return () => {
      clearMarker()
    }
  }, [clearMarker])

  // Fly to / fit bounds of the selected feature
  const handleSelectFeature = useCallback((feature: GeocodingFeature) => {
    const map = mapInstanceRef.current
    if (!map) return

    // Mark that we just selected an option to prevent the debounce useEffect from reopening the list
    justSelectedRef.current = true

    // Update query, close list, blur input, and collapse search bar width
    setQuery(feature.place_name)
    setIsOpen(false)
    setIsFocused(false)
    setResults([])
    inputRef.current?.blur()

    // Remove previous marker if any
    clearMarker()

    // Add a highly visible red debug pin at the resolved center
    const el = document.createElement('div')
    el.className = 'w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-md animate-pulse'
    markerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat(feature.center)
      .addTo(map)

    // Navigate map viewport smoothly
    if (feature.bbox && feature.bbox.length === 4) {
      map.fitBounds(feature.bbox, {
        padding: 80,
        duration: 1600,
        essential: true,
      })
    } else {
      map.flyTo({
        center: feature.center,
        zoom: 15,
        duration: 1600,
        essential: true,
      })
    }
  }, [clearMarker])

  // Keyboard navigation support inside search results
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setIsFocused(false)
      inputRef.current?.blur()
      return
    }

    if (!isOpen || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelectFeature(results[selectedIndex])
      } else if (results.length > 0) {
        handleSelectFeature(results[0])
      }
    }
  }

  // Dynamic width class: 25% by default (when not used), expanding to full current width when clicked/focused
  const widthClass = isFocused || isOpen ? 'w-[40%]' : 'w-[20%]'

  return (
    <div
      ref={containerRef}
      className={`absolute top-6 left-6 z-20 transition-all duration-300 ease-out ${widthClass}`}
    >
      {/* Search Input Container */}
      <div className="relative flex items-center bg-white/80 backdrop-blur-md border border-white/40 rounded-xl shadow-lg transition-all focus-within:bg-white focus-within:border-brand-500/40 focus-within:ring-2 focus-within:ring-brand-500/10">
        {/* Search Icon */}
        <div className="absolute left-3 text-gray-400 pointer-events-none flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-4 h-4"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx={11} cy={11} r={8} />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Text Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onClick={() => {
            setIsFocused(true)
            if (query.trim()) setIsOpen(true)
          }}
          onFocus={() => {
            setIsFocused(true)
            if (query.trim()) setIsOpen(true)
          }}
          placeholder={t('map.searchPlaceholder', 'Search location.')}
          className="w-full pl-9 pr-8 py-2.5 bg-transparent text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none rounded-xl"
        />

        {/* Clear Button or Spinner */}
        <div className="absolute right-2 flex items-center justify-center">
          {isSearching ? (
            <div className="w-3.5 h-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          ) : query ? (
            <button
              onClick={() => {
                justSelectedRef.current = false
                setQuery('')
                setResults([])
                setIsOpen(false)
                clearMarker()
                inputRef.current?.focus()
              }}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Clear search"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-3.5 h-3.5"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown Results */}
      {isOpen && query.trim() !== '' && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-xl border border-white/50 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {isSearching && results.length === 0 ? (
            <div className="px-4 py-3 text-center text-xs text-gray-400">
              {t('map.searching', 'Searching…')}
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-center text-xs text-gray-400">
              {t('map.noResults', 'No locations found')}
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto sidebar-scroll py-1">
              {results.map((feature, index) => {
                const isSelected = index === selectedIndex
                // Split primary place title from the extra context string
                const parts = feature.place_name.split(', ')
                const primaryTitle = parts[0]
                const secondarySubtitle = parts.slice(1).join(', ')

                return (
                  <button
                    key={feature.id}
                    onClick={() => handleSelectFeature(feature)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full text-left px-3 py-2 transition-colors flex flex-col gap-0.5 ${isSelected ? 'bg-brand-50/80' : 'hover:bg-gray-50/80'
                      }`}
                  >
                    <span
                      className={`text-xs font-semibold leading-tight truncate block ${isSelected ? 'text-brand-900' : 'text-gray-800'
                        }`}
                    >
                      {primaryTitle}
                    </span>
                    {secondarySubtitle && (
                      <span
                        className={`text-[10px] leading-tight truncate block ${isSelected ? 'text-brand-600' : 'text-gray-400'
                          }`}
                      >
                        {secondarySubtitle}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
