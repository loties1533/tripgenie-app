import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import React from 'react'
import { PageLayout } from '../components/layout'
import { SkeletonCard } from '../components/ui'
import { getTrips, deleteTrip } from '../lib/api'
import { useAuthStore } from '../store'

interface DonneesVoyage {
  id: string
  destination: string
  departure: string
  return_date?: string
  travelers: number
  score: number
  mode: string
  budget: string
  [key: string]: any
}

interface ReponseVoyages {
  trips: DonneesVoyage[]
}

const MODE_COLORS: Record<string, string> = {
  party:   'bg-purple-500/15 text-purple-400 border-purple-500/30',
  luxury:  'bg-gold/15 text-gold border-gold/30',
  student: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  group:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  relax:   'bg-teal-500/15 text-teal-400 border-teal-500/30',
}

const MODE_LABELS: Record<string, string> = {
  party:   'Party 🥂',
  luxury:  'Luxury ✦',
  student: 'Student 🎒',
  group:   'Groupe 👥',
  relax:   'Relax 🌿',
}

function BarreScore({ score }: { score: number }) {
  const pourcentage   = Math.round((score || 0) * 100)
  const color = pourcentage >= 80 ? 'bg-emerald-400' : pourcentage >= 60 ? 'bg-gold' : 'bg-coral'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pourcentage}%` }} />
      </div>
      <span className={`text-xs font-bold ${color.replace('bg-', 'text-')}`}>{pourcentage}%</span>
    </div>
  )
}

export default function Trips() {
  const { user }   = useAuthStore()
  const navigate   = useNavigate()

  const { data, isLoading, error, refetch } = useQuery<ReponseVoyages>({
    queryKey: ['trips'],
    queryFn:  () => getTrips(),
    enabled:  !!user,
  })

  const gererSuppression = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!window.confirm('Supprimer ce voyage définitivement ?')) return
    try {
      await deleteTrip(id)
      refetch()
    } catch {
      alert('Erreur lors de la suppression')
    }
  }

  /* ---- Non connecté ---- */
  if (!user) {
    return (
      <PageLayout>
        <div className="text-center py-24">
          <p className="text-5xl mb-4">🔒</p>
          <h2 className="font-display text-2xl font-bold text-ink dark:text-parchment mb-2">Connexion requise</h2>
          <p className="text-muted mb-6">Connecte-toi pour accéder à tes voyages sauvegardés.</p>
          <Link to="/login" className="btn-primary">Se connecter</Link>
        </div>
      </PageLayout>
    )
  }

  const trips     = data?.trips ?? []
  const scoreMoyen  = trips.length
    ? Math.round(trips.reduce((acc, t) => acc + (t.score || 0), 0) / trips.length * 100)
    : 0

  return (
    <PageLayout>
      <div className="py-2">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink dark:text-parchment">Mes Voyages</h1>
            <p className="text-sm text-muted mt-1">
              {trips.length > 0 ? `${trips.length} itinéraire${trips.length > 1 ? 's' : ''} sauvegardé${trips.length > 1 ? 's' : ''}` : 'Aucun voyage pour l\'instant'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {trips.length > 0 && (
              <div className="flex gap-3">
                <div className="glass-premium px-4 py-2.5 rounded-xl text-center">
                  <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Voyages</p>
                  <p className="text-xl font-bold text-gold font-display">{trips.length}</p>
                </div>
                <div className="glass-premium px-4 py-2.5 rounded-xl text-center">
                  <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Score moy.</p>
                  <p className="text-xl font-bold text-gold font-display">{scoreMoyen}%</p>
                </div>
              </div>
            )}
            <Link to="/"
              className="flex items-center gap-2 bg-gold hover:bg-gold/80 text-white px-4 py-2.5 rounded-xl
                         text-sm font-bold transition-all shadow-glow-gold active:scale-95">
              + Nouveau
            </Link>
          </div>
        </div>

        {/* ── Loading ── */}
        {isLoading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="text-center py-20 glass rounded-3xl border border-red-500/20">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-muted mb-4">Impossible de charger vos voyages.</p>
            <button onClick={() => window.location.reload()} className="btn-primary">Réessayer</button>
          </div>
        )}

        {/* ── Empty ── */}
        {!isLoading && trips.length === 0 && (
          <div className="text-center py-24 glass-premium rounded-3xl shadow-glow-gold">
            <p className="text-6xl mb-5">✈️</p>
            <h3 className="font-display text-2xl font-bold text-ink dark:text-parchment mb-2">
              Votre carnet est vide
            </h3>
            <p className="text-muted mb-8 max-w-sm mx-auto">
              Laissez TripGenie vous concocter un itinéraire sur-mesure.
            </p>
            <Link to="/" className="btn-primary px-8">Créer un voyage</Link>
          </div>
        )}

        {/* ── Grid ── */}
        {trips.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {trips.map((trip, i) => (
              <motion.div key={trip.id}
                role="button"
                tabIndex={0}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4, ease: 'easeOut' }}
                onClick={() => navigate(`/trip/${trip.id}`)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/trip/${trip.id}`)}
                className="glass-premium rounded-2xl p-5 cursor-pointer
                           hover:shadow-glow-gold hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-gold/60
                           transition-all duration-300 group relative overflow-hidden border border-transparent hover:border-gold/20"
              >
                {/* Fond déco */}
                <div className="absolute top-0 right-0 w-28 h-28 bg-gold/5 rounded-full -mr-14 -mt-14
                                group-hover:bg-gold/10 transition-colors pointer-events-none" />

                {/* Destination + supprimer */}
                <div className="flex items-start justify-between mb-3 relative z-10">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-bold text-ink dark:text-parchment
                                   truncate group-hover:text-gold transition-colors leading-tight">
                      {trip.destination}
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      📅 {new Date(trip.departure).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                      {trip.return_date && trip.return_date !== trip.departure ? ` → ${new Date(trip.return_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : ''}
                      {' · '}👥 {trip.travelers || 2} pers.
                    </p>
                  </div>
                  <button
                    onClick={e => gererSuppression(e, trip.id)}
                    className="ml-2 w-7 h-7 rounded-full bg-coral/10 text-coral flex-shrink-0
                               opacity-0 group-hover:opacity-100 transition-all
                               hover:bg-coral hover:text-white flex items-center justify-center"
                    title="Supprimer"
                  >
                    <IconePoubelle />
                  </button>
                </div>

                {/* Mode + Statut badges */}
                <div className="mb-4 relative z-10 flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${MODE_COLORS[trip.mode] || MODE_COLORS.party}`}>
                    {MODE_LABELS[trip.mode] || trip.mode}
                  </span>
                  {trip.status === 'confirmed' && (
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      🟢 Confirmé
                    </span>
                  )}
                  {trip.status === 'archived' && (
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full border bg-white/5 text-muted border-white/10">
                      ⬛ Archivé
                    </span>
                  )}
                </div>

                {/* Score bar */}
                <div className="mb-4 relative z-10">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] uppercase tracking-widest text-muted font-semibold">Score</p>
                  </div>
                  <BarreScore score={trip.score} />
                </div>

                {/* Budget + flèche */}
                <div className="flex items-center justify-between border-t border-gold/10 pt-3 relative z-10">
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-widest font-semibold">Budget</p>
                    <p className="text-base font-bold text-ink dark:text-parchment font-display">
                      {trip.budget || '—'}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center text-gold
                                  group-hover:bg-gold group-hover:text-white transition-all duration-300">
                    →
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  )
}

function IconePoubelle() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}
