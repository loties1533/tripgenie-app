import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PageLayout } from '../components/layout'
import { useAuthStore } from '../store'
import { login, signup } from '../lib/api'

export default function LoginPage() {
  const [tab, setTab]       = useState('login')
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [name, setName]     = useState('')
  const [err, setErr]       = useState('')
  const [loading, setLoad]  = useState(false)
  const { setAuth }         = useAuthStore()
  const navigate            = useNavigate()

  const submit = async () => {
    setErr('')
    if (!email || !pass) return setErr('Remplis tous les champs')
    setLoad(true)
    try {
      const data = tab === 'login'
        ? await login(email, pass)
        : await signup(email, pass, name)
      setAuth(data.user)
      navigate('/')
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoad(false)
    }
  }

  const inputCls = `w-full bg-white dark:bg-ink-light border border-parchment-dark dark:border-white/10
    rounded-xl px-4 py-3 text-sm text-ink dark:text-parchment placeholder:text-muted
    focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/10 transition-all`

  return (
    <PageLayout>
      <div className="max-w-sm mx-auto py-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-8 border border-gold/20 shadow-card-lg">

          {/* Logo */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gold/20 border border-gold/40 flex items-center justify-center mx-auto mb-3">
              <span className="text-gold text-xl">✦</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-ink dark:text-parchment">TripGenie</h1>
            <p className="text-sm text-muted mt-1">Votre assistant voyage IA</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-parchment-dark dark:bg-ink rounded-xl mb-6">
            {['login', 'signup'].map(t => (
              <button key={t} onClick={() => { setTab(t); setErr('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                  ${tab === t ? 'bg-white dark:bg-ink-light text-ink dark:text-parchment shadow-sm' : 'text-muted'}`}>
                {t === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="space-y-3">
            {tab === 'signup' && (
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Ton prénom" className={inputCls} />
            )}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email" className={inputCls} />
            <input type="password" value={pass} onChange={e => setPass(e.target.value)}
              placeholder="Mot de passe" className={inputCls}
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          {err && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mt-3 text-sm text-coral bg-coral/5 rounded-lg px-3 py-2">
              {err}
            </motion.p>
          )}

          <button onClick={submit} disabled={loading}
            className="btn-primary w-full mt-5 flex items-center justify-center gap-2">
            {loading
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : tab === 'login' ? 'Se connecter' : 'Créer mon compte'
            }
          </button>

          <p className="text-center text-xs text-muted mt-4">
            <Link to="/" className="hover:text-ink dark:hover:text-parchment transition-colors">
              ← Retour à l'accueil
            </Link>
          </p>
        </motion.div>
      </div>
    </PageLayout>
  )
}
