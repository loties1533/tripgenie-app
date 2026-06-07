import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Component to handle map centering when coords change
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
  }, [center, zoom, map])
  return null
}

// Custom icon generator
const createCustomIcon = (emoji: string, color = '#D4AF37') => L.divIcon({
  html: `
    <div style="
      background: white;
      width: 35px;
      height: 35px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      box-shadow: 0 0 15px ${color}66, inset 0 0 5px rgba(0,0,0,0.1);
      border: 2px solid ${color};
      cursor: pointer;
      transition: transform 0.2s;
    " class="marker-hover">
      ${emoji}
    </div>
  `,
  className: 'custom-div-icon',
  iconSize: [35, 35],
  iconAnchor: [17, 35],
})

export default function TripMap({ destination, hotels = [], focusedLocation = null }: { destination: string, hotels?: any[], focusedLocation?: [number, number] | null }) {
  const [center, setCenter] = useState<[number, number] | null>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function initPoints() {
      if (!destination) return
      setLoading(true)
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}&limit=1`)
        const data = await res.json()
        
        let mainCoords = null
        if (data && data.length > 0) {
          mainCoords = [parseFloat(data[0].lat), parseFloat(data[0].lon)] as [number, number]
          setCenter(mainCoords)
        }

        const hotelMarkers = []
        for (const hotel of hotels.slice(0, 3)) {
          const hRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(hotel.name + ' ' + destination)}&limit=1`)
          const hData = await hRes.json()
          if (hData && hData.length > 0) {
            hotelMarkers.push({
              id: hotel.name,
              coords: [parseFloat(hData[0].lat), parseFloat(hData[0].lon)] as [number, number],
              name: hotel.name,
              type: 'hotel',
              emoji: hotel.emoji || '🏨'
            })
          }
        }
        setMarkers(hotelMarkers)
      } catch (err) {
        console.error("Mapping error:", err)
      } finally {
        setLoading(false)
      }
    }
    initPoints()
  }, [destination, hotels])

  useEffect(() => {
    if (focusedLocation) {
      setCenter(focusedLocation)
    }
  }, [focusedLocation])

  if (loading) {
    return (
      <div className="w-full h-[400px] bg-ink/20 animate-pulse rounded-3xl flex items-center justify-center border border-white/5">
        <p className="text-muted text-sm">Chargement de la carte...</p>
      </div>
    )
  }

  if (!center) return null

  return (
    <div className="w-full h-[400px] rounded-3xl overflow-hidden border border-white/10 shadow-glow-gold relative z-0">
      <style>{`
        .leaflet-popup-content-wrapper {
          background: rgba(28, 28, 30, 0.8) !important;
          backdrop-filter: blur(10px);
          color: #F2F2F7 !important;
          border-radius: 12px !important;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .leaflet-popup-tip {
          background: rgba(28, 28, 30, 0.8) !important;
        }
        .marker-hover:hover {
          transform: scale(1.2) translateY(-5px);
        }
      `}</style>
      <MapContainer 
        center={center} 
        zoom={13} 
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <ChangeView center={center} zoom={13} />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {/* Main City Marker */}
        <Marker position={center} icon={createCustomIcon('✨', '#D4AF37')}>
          <Popup>
            <div className="p-1">
              <p className="font-bold text-gold text-sm">✨ {destination}</p>
              <p className="text-[10px] opacity-70">Ta destination de rêve</p>
            </div>
          </Popup>
        </Marker>

        {/* Hotel Markers */}
        {markers.map(m => (
          <Marker key={m.id} position={m.coords} icon={createCustomIcon(m.emoji, '#86efac')}>
            <Popup>
              <div className="p-1">
                <p className="font-bold text-sm">{m.emoji} {m.name}</p>
                <p className="text-[10px] text-sage">Hébergement sélectionné</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
