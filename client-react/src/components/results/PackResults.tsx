import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { RadialBarChart, RadialBar, Cell, ResponsiveContainer, PieChart, Pie, Tooltip } from 'recharts'
import { useSearchStore } from '../../store'
import { TabBar, SectionTitle, Stars, VerifiedBadge, ModeBadge } from '../ui'
import { saveVote } from '../../lib/api'
import PackSkeleton from './PackSkeleton'
import TripMap from './TripMap'
import VoteButtons from './VoteButtons'

// ---- Internal Components ----
const TagBadge = ({ text }: { text?: string }) => {
  if (!text) return null
  return (
    <span className="bg-sage/10 text-sage text-[10px] px-2 py-0.5 rounded-full border border-sage/20 whitespace-nowrap">
      {text}
    </span>
  )
}

// ---- Hotel card ----
function HotelCard({ hotel }: { hotel: any }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl overflow-hidden group hover:shadow-card-lg transition-shadow duration-300">
      {/* Photo */}
      <div className="h-36 bg-parchment-dark dark:bg-ink-light relative overflow-hidden">
        {hotel.photo_url
          ? <img src={hotel.photo_url} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center text-5xl opacity-30">{hotel.emoji || '🏨'}</div>
        }
        {hotel.is_real && (
          <div className="absolute top-2 left-2"><VerifiedBadge /></div>
        )}
        {hotel.rating && (
          <div className="absolute top-2 right-2 bg-white/90 dark:bg-ink/90 rounded-lg px-2 py-1 text-xs font-bold text-ink dark:text-parchment">
            {hotel.rating} <span className="text-gold">★</span>
          </div>
        )}
      </div>
      {/* Body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-ink dark:text-parchment text-sm leading-tight">{hotel.name}</h4>
          <Stars count={hotel.stars} />
        </div>
        <p className="text-xs text-muted mt-1 flex items-center gap-1">
          <span>📍</span>{hotel.location}
        </p>
        {hotel.highlights && (
          <p className="text-xs text-muted mt-2 line-clamp-2 leading-relaxed">{hotel.highlights}</p>
        )}
        {hotel.review_count > 0 && (
          <p className="text-xs text-muted/70 mt-1">{hotel.review_count} avis · {hotel.rating_label}</p>
        )}
      </div>
      {/* Footer */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">par nuit</p>
          <p className="font-bold text-gold text-lg">{hotel.price_per_night}</p>
        </div>
        <a href={hotel.booking_url || `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotel.name)}`}
           target="_blank" rel="noopener"
           className="btn-primary text-sm px-4 py-2">
          Réserver
        </a>
      </div>
    </motion.div>
  )
}

// ---- Flight card ----
function FlightCard({ flight, packId, destination }: { flight: any; packId: string; destination: string }) {
  const isReturn  = flight.type === 'return'
  // Google Flights = comparateur fiable (jamais de 404). Pré-rempli (villes+dates+pax)
  // pour les nouveaux packs ; repli recherche par villes pour les anciens packs en base.
  const bookingUrl = flight.links?.google
    || `https://www.google.com/travel/flights?q=${encodeURIComponent(`Vols ${flight.from_city || 'Paris'} ${flight.to_city || destination}`)}`

  return (
    <motion.div initial={{ opacity: 0, x: isReturn ? 8 : -8 }} animate={{ opacity: 1, x: 0 }}
      className="glass rounded-2xl p-4 group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-gold/10 text-gold rounded-md border border-gold/20">
            {isReturn ? 'Retour' : 'Aller'}
          </span>
          <span className="text-xs text-muted font-medium">{flight.airline}</span>
        </div>
        <div className="flex items-center gap-3">
          <VoteButtons packId={packId} itemId={`flight-${flight.type}-${flight.airline}`} />
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter ${flight.stops === 'Direct' ? 'bg-sage/10 text-sage border border-sage/20' : 'bg-coral/10 text-coral border border-coral/20'}`}>
            {flight.stops}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-center flex-1">
          <p className="text-2xl font-bold text-ink dark:text-parchment font-display leading-none">{flight.departure_time}</p>
          <p className="text-[10px] font-bold text-muted mt-1 uppercase tracking-tighter">{flight.from} · {flight.from_city}</p>
        </div>
        <div className="flex-[0.5] flex flex-col items-center gap-1 opacity-50">
          <p className="text-[9px] font-bold text-muted uppercase">{flight.duration}</p>
          <div className="w-full flex items-center gap-1">
            <div className="h-px flex-1 bg-muted/30" />
            <span className="text-muted text-[10px]">✈</span>
            <div className="h-px flex-1 bg-muted/30" />
          </div>
        </div>
        <div className="text-center flex-1">
          <p className="text-2xl font-bold text-ink dark:text-parchment font-display leading-none">{flight.arrival_time}</p>
          <p className="text-[10px] font-bold text-muted mt-1 uppercase tracking-tighter">{flight.to} · {flight.to_city}</p>
        </div>
        <div className="pl-4 border-l border-white/5 flex flex-col items-end gap-1">
          <p className="text-lg font-bold text-gold leading-none">{flight.price_per_person}</p>
          <p className="text-[9px] text-muted/60 italic">estimatif</p>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold text-sage hover:underline flex items-center gap-0.5"
          >
            Vrai prix ↗
          </a>
        </div>
      </div>
    </motion.div>
  )
}

// ---- Itinerary day ----
function ItineraryDay({ day, destination }: { day: any; destination: string }) {
  const [open, setOpen] = useState(true)
  const icons: Record<string, string> = { activity: '🏛', food: '🍽', event: '🎉', transport: '🚗' }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gold/5 transition-colors">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-gold/15 text-gold font-bold text-sm flex items-center justify-center">
            {day.day}
          </span>
          <div className="text-left">
            <p className="font-semibold text-ink dark:text-parchment text-sm">{day.title}</p>
            <p className="text-xs text-muted">{day.subtitle}</p>
          </div>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-muted text-sm">▼</motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
            className="px-5 pb-4 space-y-3 border-t border-parchment-dark dark:border-white/10">
            {day.items?.map((item: any, i: number) => (
              <motion.div key={i} className="flex gap-3 pt-3"
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}>
                <div className="text-center flex-shrink-0 w-12">
                  <p className="text-xs font-medium text-gold">{item.time}</p>
                  <p className="text-lg">{icons[item.type] || '📍'}</p>
                </div>
                <div className="flex-1">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((item.title || '') + ' ' + destination)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="font-medium text-sm text-ink dark:text-parchment hover:text-gold transition-colors inline-flex items-center gap-1 group/loc"
                  >
                    {item.title}
                    <span className="opacity-0 group-hover/loc:opacity-100 text-[10px] text-gold transition-opacity">📍</span>
                  </a>
                  {item.description && (
                    <p className="text-xs text-muted mt-0.5 leading-relaxed">{item.description}</p>
                  )}
                  <div className="flex gap-3 mt-1.5">
                    {item.price && <span className="text-xs text-sage font-medium">{item.price}</span>}
                    {item.duration && <span className="text-xs text-muted">{item.duration}</span>}
                  </div>
                </div>
              </motion.div>
            ))}
            
            {/* Proactive Plan B */}
            {day.plan_b && (
              <div className="mt-4 p-3 rounded-xl bg-gold/5 border border-gold/10 flex gap-3">
                <span className="text-lg">✨</span>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-gold uppercase tracking-wider">Alternative Proactive</p>
                  <p className="text-xs text-muted leading-relaxed italic">{day.plan_b}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---- Budget breakdown chart ----
function BudgetChart({ breakdown }: { breakdown: any }) {
  if (!breakdown) return null
  const entries = Object.entries(breakdown).filter(([k]) => k !== 'total')
  const colors  = ['#C9A84C', '#5A7A5E', '#3A6B8A', '#C0634A', '#7A6E62', '#8B6914']
  const data    = entries.map(([k, v], i) => ({
    name:  k.charAt(0).toUpperCase() + k.slice(1),
    value: parseInt(v as string) || 0,
    color: colors[i % colors.length]
  }))
  const total = breakdown.total || '—'

  return (
    <div className="glass rounded-2xl p-5">
      <SectionTitle sub={`Répartition indicative · Total : ${total}`}>Budget</SectionTitle>
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="w-44 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={72}
                   dataKey="value" paddingAngle={2} isAnimationActive={false}>
                {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v) => `${v}€`} contentStyle={{ background: 'var(--color-bg, #fff)', border: 'none', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span className="text-sm text-muted capitalize">{d.name}</span>
              </div>
              <span className="text-sm font-medium text-ink dark:text-parchment">{d.value}€</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- Event card ----
function EventCard({ event, destination }: { event: any; destination: string }) {
  const query = encodeURIComponent(`${event.name || event.title || ''} ${destination || ''}`)
  const bookingUrl = event.booking_url || event.links?.viator || event.links?.getyourguide
    || `https://www.getyourguide.fr/s/?q=${query}`

  return (
    <div className="flex gap-3 p-3 glass rounded-xl">
      <div className="w-10 h-10 bg-coral/10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">🎭</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-ink dark:text-parchment truncate">{event.title}</p>
        <p className="text-xs text-muted mt-0.5">{event.start} · {event.venue}</p>
        {event.description && <p className="text-xs text-muted mt-1 line-clamp-2">{event.description}</p>}
        <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
          className="inline-block mt-2 text-[10px] font-bold text-sage hover:underline">
          Réserver / Infos ↗
        </a>
      </div>
    </div>
  )
}

// ---- Activity card ----
function ActivityCard({ activity }: { activity: any }) {
  return (
    <div className="glass rounded-xl p-4 flex gap-3">
      <span className="text-2xl">{activity.emoji || '🎯'}</span>
      <div className="flex-1">
        <p className="font-semibold text-sm text-ink dark:text-parchment">{activity.name}</p>
        <p className="text-xs text-muted mt-0.5">{activity.category}</p>
        <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-2">{activity.description}</p>
        <div className="flex gap-3 mt-2">
          <span className="text-xs text-sage font-medium">{activity.price}</span>
          <span className="text-xs text-muted">{activity.duration}</span>
          <span className="text-xs text-muted">{activity.best_time}</span>
        </div>
      </div>
    </div>
  )
}

// =============================================
// MAIN PACK RESULTS
// =============================================
const TABS = [
  { id: 'overview',    label: 'Aperçu',      icon: '✦' },
  { id: 'hotels',      label: 'Hôtels',      icon: '🏨' },
  { id: 'flights',     label: 'Vols',        icon: '✈' },
  { id: 'itinerary',   label: 'Temps forts',  icon: '📅' },
  { id: 'activities',  label: 'Activités',   icon: '🎯' },
  { id: 'budget',      label: 'Budget',      icon: '💰' },
]

export default function PackResults() {
  const { pack, tripId, packId, isLoading, mode, departure, returnDate, travelers } = useSearchStore()
  const [activeTab, setActiveTab]       = useState('overview')
  const [focusedLocation, setFocusedLocation] = useState<[number, number] | null>(null)

  if (isLoading) {
    return <PackSkeleton />
  }

  if (!pack) return null

  const d = pack

  // Score TripGenie (algo déterministe) — rendu visible + détaillé par critère.
  const scoreVal      = typeof d.score === 'number' ? d.score : (d.score?.total ?? 0)
  const scorePct      = Math.round(scoreVal * 100)
  const scoreDetails  = typeof d.score === 'object' ? d.score?.details : undefined
  const scoreCriteria = scoreDetails
    ? [
        { label: 'Ambiance',  val: Math.round((scoreDetails.events     ?? 0) * 100) },
        { label: 'Prix',      val: Math.round((scoreDetails.prix       ?? 0) * 100) },
        { label: 'Hôtel',     val: Math.round((scoreDetails.hotel      ?? 0) * 100) },
        { label: 'Vol',       val: Math.round((scoreDetails.vol        ?? 0) * 100) },
        { label: 'Activités', val: Math.round((scoreDetails.activities ?? 0) * 100) },
      ]
    : []

  // Bandeau Mode Survie — affiché quand toutes les IA ont échoué et que le pack
  // est un fallback statique. Important pour la transparence envers l'utilisateur.
  const MockBanner = d.isMock ? (
    <div className="mx-4 mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
      <span className="text-xl flex-shrink-0">⚠️</span>
      <div>
        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">Données de démonstration</p>
        <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
          Les services IA sont temporairement indisponibles. Ce pack est un exemple générique — réessayez dans quelques minutes pour un vrai résultat personnalisé.
        </p>
      </div>
    </div>
  ) : null

  // Function to center map on an item
  const handleLocate = async (name: string) => {
    setActiveTab('overview')
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name + ' ' + d.destination)}&limit=1`)
      const data = await res.json()
      if (data && data.length > 0) {
        setFocusedLocation([parseFloat(data[0].lat), parseFloat(data[0].lon)])
        // Scroll to top to see the map
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (err) {
      console.error("Locate error:", err)
    }
  }

  // Function to share via WhatsApp
  const handleShare = () => {
    const url = window.location.href
    const text = `🌍 *TripGenie* : Voyage à ${d.destination} !\n\n` +
                 `📅 *Dates* : Du ${departure || '?'} au ${returnDate || '?'}\n` +
                 `🏨 *Hôtel* : ${d.hotels?.[0]?.name || 'À choisir'}\n` +
                 `💰 *Budget* : ${d.summary?.total_budget || 'À définir'}\n\n` +
                 `✨ _"${d.tagline}"_\n\n` +
                 `Découvre le programme complet ici : ${url}`

    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(waUrl, '_blank')
  }

  // ---- Internal Cards with Locate & Vote button ----
  const LocalHotelCard = ({ hotel }: { hotel: any }) => (
    <div className="glass rounded-xl p-4 flex flex-col gap-3 group hover:border-gold/30 transition-colors">
      <div className="flex gap-3">
        <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center text-2xl border border-gold/20">🏨</div>
        <div className="flex-1">
          <p className="font-semibold text-sm text-ink dark:text-parchment">{hotel.name}</p>
          <p className="text-xs text-muted mt-0.5">{hotel.location} · {hotel.stars}★</p>
          <div className="flex gap-2 mt-2">
            <button 
              onClick={() => handleLocate(hotel.name)}
              className="text-[10px] uppercase tracking-wider font-bold text-gold hover:text-gold/80 flex items-center gap-1 transition-colors"
            >
              📍 Carte
            </button>
            <a
              href={hotel.booking_url || hotel.links?.booking || `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotel.name + ' ' + d.destination)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] uppercase tracking-wider font-bold text-sage hover:text-sage/80 flex items-center gap-1 transition-colors"
            >
              Réserver ↗
            </a>
            {hotel.links?.google && (
              <a href={hotel.links.google} target="_blank" rel="noopener noreferrer"
                className="text-[10px] uppercase tracking-wider font-bold text-muted hover:text-gold flex items-center gap-1 transition-colors">
                Google ↗
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-parchment-dark dark:border-white/10">
        <span className="text-xs font-bold text-gold">{hotel.price_per_night}</span>
        <div className="flex items-center gap-3">
          <VoteButtons packId={packId ?? ''} itemId={hotel.name} />
          <TagBadge text={hotel.match_reason} />
        </div>
      </div>
    </div>
  )

  const LocalActivityCard = ({ activity }: { activity: any }) => (
    <div className="glass rounded-xl p-5 flex flex-col gap-4 hover:border-gold/40 transition-colors shadow-sm">
      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0 border border-gold/20">
          <span className="text-2xl">{activity.emoji || '🎯'}</span>
        </div>
        <div className="flex-1">
          <p className="font-display font-bold text-lg text-ink dark:text-parchment leading-tight">{activity.name}</p>
          <p className="text-xs text-gold font-semibold uppercase tracking-widest mt-1">{activity.category || 'Expérience'}</p>
          <p className="text-sm text-muted/90 mt-2 leading-relaxed">{activity.desc || activity.description}</p>
          {activity.plan_b && (
            <div className="mt-3 p-2 bg-gold/5 rounded-lg border border-gold/10 flex items-start gap-2">
              <span className="text-sm">✨</span>
              <div>
                <p className="text-[10px] text-gold font-bold uppercase tracking-wider">Plan B Proactif</p>
                <p className="text-xs text-muted italic leading-tight mt-0.5">{activity.plan_b}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-parchment-dark dark:border-white/10 mt-auto">
        <div className="flex gap-2">
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(activity.name + ' ' + d.destination)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold text-ink dark:text-parchment bg-parchment-dark dark:bg-ink-light hover:bg-gold hover:text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
          >
            📍 Carte
          </a>
          <a
            href={activity.reserve_url || activity.links?.getyourguide || activity.links?.viator || `https://www.getyourguide.fr/s/?q=${encodeURIComponent((activity.name || activity.title) + ' ' + d.destination)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold text-white bg-gold hover:bg-gold-dark px-4 py-1.5 rounded-lg transition-colors shadow-glow-gold hover:shadow-none flex items-center gap-1.5"
          >
            Réserver ↗
          </a>
        </div>
        <VoteButtons packId={packId ?? ''} itemId={activity.name || activity.title} />
      </div>
    </div>
  )


  return (
    <motion.div id="pack-results" className="mt-10 space-y-5"
      data-mode={mode}
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}>

      {/* Bandeau Mode Survie — visible uniquement quand isMock: true */}
      {MockBanner}

      {/* Hero banner */}
      <div className="glass-premium rounded-3xl p-4 sm:p-6 relative overflow-hidden shadow-glow-gold min-h-[220px] sm:min-h-[260px] flex items-end">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src={d.photo_url || `https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80`}
            alt={d.destination}
            className="w-full h-full object-cover opacity-40 transition-transform duration-[20s]"
            onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-parchment via-parchment/85 to-parchment/30 dark:from-ink dark:via-ink/85 dark:to-ink/40" />
        </div>

        <div className="relative z-10 w-full">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ModeBadge mode={mode} />
                {tripId && (
                  <motion.span 
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="bg-sage/10 text-sage text-[10px] px-2 py-0.5 rounded-full border border-sage/20 font-bold uppercase tracking-widest"
                  >
                    ✦ Sauvegardé
                  </motion.span>
                )}
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink dark:text-parchment flex flex-wrap items-center gap-2">
                {d.destination}
                <span className="text-muted text-lg sm:text-xl font-normal">{d.country}</span>
                <button
                  onClick={handleShare}
                  className="bg-sage/20 hover:bg-sage/40 text-sage px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border border-sage/20"
                >
                  <span className="text-base">📲</span>
                  <span className="hidden sm:inline">Partager</span>
                </button>
              </h2>
              <p className="text-gold-dark dark:text-gold italic font-display mt-1 drop-shadow-sm">{d.tagline}</p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              {/* Score TripGenie — visible dès l'apparition du pack + détail de l'algo par critère */}
              {d.score != null && (
                <div className="glass-premium rounded-xl px-3 py-1.5 border border-gold/30 shadow-glow-gold w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <div className="text-center flex-shrink-0">
                      <div className="flex items-baseline gap-0.5 justify-center">
                        <span className="text-lg font-bold text-gold font-display leading-none">{scorePct}</span>
                        <span className="text-[10px] text-muted">/100</span>
                      </div>
                      <span className="text-[8px] uppercase tracking-widest text-muted">Score</span>
                    </div>
                    {scoreCriteria.length > 0 && (
                      <div className="border-l border-gold/20 pl-2 grid grid-cols-2 gap-x-2 gap-y-0">
                        {scoreCriteria.map(c => (
                          <div key={c.label} className="flex items-center justify-between gap-1.5 text-[9px] whitespace-nowrap">
                            <span className="text-muted">{c.label}</span>
                            <span className="font-bold text-ink dark:text-parchment">{c.val}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <div className="glass rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                  <span className="text-gold font-bold text-base font-display">{travelers ?? '—'}</span>
                  <span className="text-[10px] text-muted uppercase tracking-tighter">voy.</span>
                </div>
                <div className="glass rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                  <span className="text-gold font-bold text-base font-display">{d.summary?.nights}</span>
                  <span className="text-[10px] text-muted uppercase tracking-tighter">nuits</span>
                </div>
                <div className="glass rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                  <span className="text-gold font-bold text-base font-display">{d.summary?.total_budget}</span>
                  <span className="text-[10px] text-muted uppercase tracking-tighter">budget</span>
                </div>
              </div>
            </div>
          </div>

          {/* Weather */}
          {d.weather && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
              <span className="text-xl">🌤</span>
              <span className="font-medium text-ink dark:text-parchment">{d.weather.avg_temp}</span>
              <span>·</span>
              <span>{d.weather.conditions}</span>
              {d.weather.humidity != null && <><span>·</span><span>💧 {d.weather.humidity}%</span></>}
              {d.weather.wind && <><span>·</span><span>💨 {d.weather.wind}</span></>}
              <span>·</span>
              <span className="italic">{d.weather.tip}</span>
            </div>
          )}

          {/* Overview */}
          {d.overview && (
            <p className="mt-4 text-sm leading-relaxed text-muted border-l-2 border-gold/40 pl-4 italic">
              {d.overview}
            </p>
          )}

          {/* Tips */}
          {(d.tips?.length ?? 0) > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {d.tips?.map((tip, i) => (
                <div key={i} className="bg-gold/5 rounded-xl px-3 py-2 text-xs">
                  <span className="font-semibold text-ink dark:text-parchment">{tip.title} · </span>
                  <span className="text-muted">{tip.content}</span>
                </div>
              ))}
            </div>
          )}

          {/* Phrase locale */}
          {d.local_phrases?.[0] && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-xl">🗣</span>
              <span className="font-display italic text-gold">"{d.local_phrases[0].phrase}"</span>
              <span className="text-muted text-xs">= {d.local_phrases[0].translation}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}>

          {activeTab === 'overview' && (
            <div className="space-y-4">
              <TripMap
                destination={d.destination}
                hotels={d.hotels}
                focusedLocation={focusedLocation}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {d.hotels?.slice(0, 2).map((h, i) => <LocalHotelCard key={i} hotel={h} />)}
                {d.flights?.slice(0, 2).map((f, i) => <FlightCard key={i} flight={f} packId={packId ?? ''} destination={d.destination} />)}
                {d.events?.slice(0, 3).map((e, i) => <EventCard key={i} event={e} destination={d.destination} />)}
              </div>
            </div>
          )}

          {activeTab === 'hotels' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {d.hotels?.map((h, i) => <LocalHotelCard key={i} hotel={h} />)}
            </div>
          )}

          {activeTab === 'flights' && (
            <div className="space-y-3">
              {d.flights?.map((f, i) => <FlightCard key={i} flight={f} packId={packId ?? ''} destination={d.destination} />)}
            </div>
          )}

          {activeTab === 'itinerary' && (
            <div className="space-y-3">
              {d.itinerary?.map((day, i) => <ItineraryDay key={i} day={day} destination={d.destination} />)}
            </div>
          )}

          {activeTab === 'activities' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {d.activities?.map((a, i) => <LocalActivityCard key={i} activity={a} />)}
            </div>
          )}

          {activeTab === 'budget' && <BudgetChart breakdown={d.budget_breakdown} />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
