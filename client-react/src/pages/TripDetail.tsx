import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { PageLayout } from '../components/layout'
import Seo from '../components/Seo'
import PackResults from '../components/results/PackResults'
import ModifyChat from '../components/chat/ModifyChat'
import Logo from '../components/ui/Logo'
import { SkeletonCard } from '../components/ui'
import { getPublicTrip, updateTrip } from '../lib/api'
import { useSearchStore } from '../store'

export default function TripDetail() {
  const { id }                        = useParams()
  const { setPack, setField, tripId } = useSearchStore()
  const [chatOpen, setChatOpen]       = useState(false)
  const [status, setStatus]           = useState<string | null>(null)
  const [statutEnChargement, setStatutEnChargement] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['trip', id],
    queryFn:  () => getPublicTrip(id as string),
    enabled:  !!id,
  })

  useEffect(() => {
    if (data?.trip?.pack_data && tripId !== data.trip.id) {
      setPack(data.trip.pack_data, data.trip.id, data.trip.pack_id ?? null)
    }
    // Toujours hydrater le store depuis la BDD (source de vérité), même sur un voyage
    // fraîchement généré : le store top-level garde sinon ses défauts (2 voyageurs, dates vides).
    if (data?.trip) {
      setField('mode', data.trip.mode || 'party')
      if (data.trip.travelers != null)   setField('travelers', data.trip.travelers)
      if (data.trip.departure)           setField('departure', data.trip.departure)
      if (data.trip.return_date)         setField('returnDate', data.trip.return_date)
    }
    if (data?.trip?.status) setStatus(data.trip.status)
  }, [data])

  const gererStatut = async (newStatus: string) => {
    if (!id || statutEnChargement) return
    setStatutEnChargement(true)
    try {
      await updateTrip(id, { status: newStatus })
      setStatus(newStatus)
    } catch {
      /* silencieux */
    } finally {
      setStatutEnChargement(false)
    }
  }

  /* ---- Loading ---- */
  if (isLoading) {
    return (
      <PageLayout>
      <Seo title="Votre voyage" noindex />
        <div className="space-y-4 mt-6">
          <SkeletonCard />
          <div className="grid grid-cols-2 gap-4">
            <SkeletonCard /><SkeletonCard />
          </div>
        </div>
      </PageLayout>
    )
  }

  /* ---- Error ---- */
  if (error) {
    return (
      <PageLayout>
      <Seo title="Votre voyage" noindex />
        <div className="text-center py-24">
          <p className="text-5xl mb-4">🔍</p>
          <h2 className="text-2xl font-bold text-ink mb-2">
            Voyage introuvable
          </h2>
          <p className="text-muted mb-6">Ce lien de partage est invalide ou expiré.</p>
          <Link to="/" className="btn-primary">Créer un voyage</Link>
        </div>
      </PageLayout>
    )
  }

  /* ---- Content ---- */
  return (
    <PageLayout>
      <Seo title="Votre voyage" noindex />
      {data?.trip && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-5 items-start">

            {/* ── Left : Pack ── */}
            <div className="flex-1 min-w-0">

              {/* Barre d'actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <p className="text-sm text-muted truncate max-w-[200px] sm:max-w-none">
                  <span className="font-semibold text-ink">
                    {data.trip.destination}
                  </span>
                  {' · '}{data.trip.travelers} pers.
                  {data.trip.budget ? ` · ${data.trip.budget}` : ''}
                </p>

                <div className="flex gap-2">
                  {/* Bouton Modifier : visible partout, mais sur mobile ouvre la bottom sheet */}
                  <button
                    onClick={() => setChatOpen(v => !v)}
                    className={`text-sm px-4 py-2 rounded-md font-bold transition-all border flex items-center gap-1.5 ${
                      chatOpen
                        ? 'bg-gold text-white border-gold'
                        : 'border-gold/30 text-gold hover:bg-gold/10'
                    }`}
                  >
                    ✏️ {chatOpen ? 'Fermer' : 'Modifier'}
                  </button>
                </div>
              </div>

              {/* Workflow statut */}
              {status && (
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span className="text-[10px] uppercase tracking-widest text-muted font-semibold">Statut :</span>
                  {[
                    { key: 'draft',     label: '🟡 Brouillon',  desc: 'Pack généré, non validé' },
                    { key: 'confirmed', label: '🟢 Confirmé',   desc: 'Je pars !' },
                    { key: 'archived',  label: '⬛ Archivé',    desc: 'Voyage terminé' },
                  ].map(s => (
                    <button key={s.key}
                      onClick={() => gererStatut(s.key)}
                      disabled={statutEnChargement || status === s.key}
                      title={s.desc}
                      className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-all ${
                        status === s.key
                          ? 'bg-gold text-white border-gold'
                          : 'border-gold/20 text-muted hover:border-gold/50 hover:text-ink'
                      } disabled:opacity-50`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              <PackResults />
            </div>

            {/* ── Right : Chat modifier (desktop uniquement lg+) ── */}
            <AnimatePresence>
              {chatOpen && (
                <motion.div
                  key="modify-panel"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.25 }}
                  className="hidden lg:flex flex-col flex-shrink-0 sticky top-20"
                  style={{ width: 340, height: 'calc(100vh - 6rem)' }}
                >
                  <div className="glass-premium rounded-md overflow-hidden h-full flex flex-col border border-gold/20">

                    {/* Header du panel */}
                    <div className="px-4 py-3 border-b border-gold/10 flex items-center justify-between
                                    bg-gradient-to-r from-gold/5 to-transparent">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-light to-gold-dark
                                        flex items-center justify-center">
                          <Logo size={17} className="text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-ink leading-none">
                            Modifier le pack
                          </p>
                          <p className="text-[11px] text-muted mt-0.5">{data.trip.destination}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setChatOpen(false)}
                        className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center
                                   text-muted hover:text-ink transition-colors text-base"
                      >
                        ×
                      </button>
                    </div>

                    {/* Résumé rapide du pack actuel */}
                    <div className="px-4 py-2.5 border-b border-gold/10 bg-gold/3">
                      <p className="text-[10px] uppercase tracking-widest text-muted font-semibold mb-1.5">Pack actuel</p>
                      <div className="space-y-0.5 text-xs text-muted">
                        {data.trip.pack_data?.flights?.[0] && (
                          <p>✈️ {data.trip.pack_data.flights[0].airline || 'Vol'} · {data.trip.pack_data.flights[0].price_per_person || '–'}/pers</p>
                        )}
                        {data.trip.pack_data?.hotels?.[0] && (
                          <p>🏨 {data.trip.pack_data.hotels[0].name} · {data.trip.pack_data.hotels[0].price_per_night || '–'}/nuit</p>
                        )}
                        {data.trip.pack_data?.summary && (
                          <p>📅 {data.trip.pack_data.summary.nights} nuits · {data.trip.pack_data.summary.activities_count || '–'} activités</p>
                        )}
                      </div>
                    </div>

                    {/* Chat */}
                    <ModifyChat tripId={id} mode={data.trip.mode} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>

          {/* ── Mobile : Bottom sheet (< lg uniquement) ── */}
          <AnimatePresence>
            {chatOpen && (
              <>
                {/* Overlay sombre */}
                <motion.div
                  key="mobile-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-40 bg-black/60 lg:hidden"
                  onClick={() => setChatOpen(false)}
                />

                {/* Sheet qui monte du bas */}
                <motion.div
                  key="mobile-chat-sheet"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                  className="fixed bottom-0 left-0 right-0 z-50 lg:hidden rounded-t-3xl overflow-hidden"
                  style={{ height: '88vh' }}
                >
                  <div className="glass-premium h-full flex flex-col border-t border-x border-gold/20 rounded-t-3xl">

                    {/* Barre de glissement */}
                    <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                      <div className="w-10 h-1 rounded-full bg-white/20" />
                    </div>

                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gold/10 flex items-center justify-between
                                    bg-gradient-to-r from-gold/5 to-transparent flex-shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-light to-gold-dark
                                        flex items-center justify-center">
                          <Logo size={17} className="text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-ink leading-none">
                            Modifier le pack
                          </p>
                          <p className="text-[11px] text-muted mt-0.5">{data.trip.destination}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setChatOpen(false)}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center
                                   text-muted hover:text-ink transition-colors text-lg"
                      >
                        ×
                      </button>
                    </div>

                    {/* Résumé pack */}
                    <div className="px-4 py-2.5 border-b border-gold/10 flex-shrink-0">
                      <p className="text-[10px] uppercase tracking-widest text-muted font-semibold mb-1.5">Pack actuel</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                        {data.trip.pack_data?.flights?.[0] && (
                          <span>✈️ {data.trip.pack_data.flights[0].airline || 'Vol'} · {data.trip.pack_data.flights[0].price_per_person || '–'}/pers</span>
                        )}
                        {data.trip.pack_data?.hotels?.[0] && (
                          <span>🏨 {data.trip.pack_data.hotels[0].name} · {data.trip.pack_data.hotels[0].price_per_night || '–'}/nuit</span>
                        )}
                        {data.trip.pack_data?.summary && (
                          <span>📅 {data.trip.pack_data.summary.nights} nuits · {data.trip.pack_data.summary.activities_count || '–'} activités</span>
                        )}
                      </div>
                    </div>

                    {/* Chat (flex-1 pour prendre toute la hauteur restante) */}
                    <div className="flex-1 min-h-0">
                      <ModifyChat tripId={id} mode={data.trip.mode} />
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* ── Mobile FAB flottant (< lg) — visible quand chat fermé ── */}
          <AnimatePresence>
            {!chatOpen && (
              <motion.button
                key="mobile-fab"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                onClick={() => setChatOpen(true)}
                className="fixed bottom-20 right-4 z-40 lg:hidden w-14 h-14 rounded-full
                           bg-gradient-to-br from-gold-light to-gold-dark text-white text-2xl
                           shadow-sm shadow-gold/40 flex items-center justify-center
                           active:scale-95 transition-transform"
                aria-label="Modifier le pack"
              >
                ✏️
              </motion.button>
            )}
          </AnimatePresence>
        </>
      )}
    </PageLayout>
  )
}
