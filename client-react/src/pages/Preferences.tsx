import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { PageLayout } from '../components/layout'
import { useAuthStore } from '../store'
import { getPreferences, savePreferences } from '../lib/api'

const MODES = [
  { value: 'party',    label: '🎉 Fête' },
  { value: 'student',  label: '🎓 Étudiant' },
  { value: 'luxury',   label: '💎 Luxe' },
  { value: 'group',    label: '👥 Groupe' },
  { value: 'relax',    label: '🌿 Détente' },
  { value: 'surprise', label: '🎁 Surprise' },
]
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD']
const INTERESTS  = ['gastronomie', 'culture', 'nightlife', 'nature', 'shopping', 'sport', 'plage', 'histoire']

export default function PreferencesPage() {
  const { user }    = useAuthStore()
  const navigate    = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  const [homeCity, setHomeCity]   = useState('')
  const [mode, setMode]           = useState('party')
  const [currency, setCurrency]   = useState('EUR')
  const [interests, setInterests] = useState<string[]>([])

  // Pas connecté → login
  useEffect(() => {
    if (!user) navigate('/login')
  }, [user])

  // Chargement des préférences existantes
  useEffect(() => {
    if (!user) return
    getPreferences()
      .then(({ preferences }) => {
        if (preferences) {
          setHomeCity(preferences.home_city ?? '')
          setMode(preferences.default_mode ?? 'party')
          setCurrency(preferences.currency ?? 'EUR')
          setInterests(preferences.preferred_prefs ?? [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  const toggleInterest = (i: string) =>
    setInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])

  const save = async () => {
    setSaving(true)
    try {
      await savePreferences({
        home_city:       homeCity,
        default_mode:    mode,
        currency,
        preferred_prefs: interests,
      })
      toast.success('Préférences enregistrées')
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de l\'enregistrement')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = `w-full bg-white dark:bg-ink-light border border-parchment-dark dark:border-white/10
    rounded-xl px-4 py-3 text-sm text-ink dark:text-parchment placeholder:text-muted
    focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/10 transition-all`

  return (
    <PageLayout>
      <div className="max-w-lg mx-auto py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-8 border border-gold/20 shadow-card-lg">

          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold text-ink dark:text-parchment">Mes préférences</h1>
            <p className="text-sm text-muted mt-1">Elles pré-remplissent chaque nouveau voyage.</p>
          </div>

          {loading
            ? <div className="py-12 flex justify-center">
                <span className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
              </div>
            : <div className="space-y-5">
                {/* Ville de départ */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Ville de départ</label>
                  <input value={homeCity} onChange={e => setHomeCity(e.target.value)}
                    placeholder="Ex : Bordeaux" className={inputCls} />
                </div>

                {/* Mode par défaut */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Mode de voyage par défaut</label>
                  <div className="grid grid-cols-3 gap-2">
                    {MODES.map(m => (
                      <button key={m.value} onClick={() => setMode(m.value)}
                        className={`py-2.5 rounded-xl text-sm font-medium border transition-all
                          ${mode === m.value
                            ? 'bg-gold text-white border-gold shadow-glow-gold'
                            : 'bg-white/5 border-white/10 text-muted hover:border-gold/40'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Devise */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Devise</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Centres d'intérêt */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Centres d'intérêt</label>
                  <div className="flex flex-wrap gap-2">
                    {INTERESTS.map(i => (
                      <button key={i} onClick={() => toggleInterest(i)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all capitalize
                          ${interests.includes(i)
                            ? 'bg-sage/30 border-sage text-sage'
                            : 'bg-white/5 border-white/10 text-muted hover:border-gold/40'}`}>
                        {i}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={save} disabled={saving}
                  className="btn-primary w-full mt-2 flex items-center justify-center gap-2">
                  {saving
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : 'Enregistrer mes préférences'}
                </button>
              </div>
          }

          <p className="text-center text-xs text-muted mt-5">
            <Link to="/" className="hover:text-ink dark:hover:text-parchment transition-colors">
              ← Retour à l'accueil
            </Link>
          </p>
        </motion.div>
      </div>
    </PageLayout>
  )
}
