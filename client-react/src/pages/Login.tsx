import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PageLayout } from '../components/layout'
import Seo from '../components/Seo'
import Logo from '../components/ui/Logo'
import { useAuthStore } from '../store'
import { login, signup } from '../lib/api'

export default function LoginPage() {
  const [onglet, setOnglet]       = useState('login')
  const [email, setEmail]   = useState('')
  const [motDePasse, setMotDePasse]     = useState('')
  const [name, setName]     = useState('')
  const [erreur, setErreur]       = useState('')
  const [chargement, setChargement]  = useState(false)
  const { setAuth }         = useAuthStore()
  const navigate            = useNavigate()

  const submit = async () => {
    setErreur('')
    if (!email || !motDePasse) return setErreur('Remplis tous les champs')
    setChargement(true)
    try {
      const reponse = onglet === 'login'
        ? await login(email, motDePasse)
        : await signup(email, motDePasse, name)
      setAuth(reponse.user)
      navigate('/')
    } catch (e: any) {
      setErreur(e.message)
    } finally {
      setChargement(false)
    }
  }

  const classeInput = `w-full bg-white border border-parchment-dark
    rounded-xl px-4 py-3 text-sm text-ink placeholder:text-muted
    focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/10 transition-all`

  return (
    <PageLayout>
      <Seo title="Connexion" description="Connectez-vous ou créez un compte TripGenie pour sauvegarder et retrouver vos voyages." path="/login" />
      <div className="max-w-sm mx-auto py-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-8 border border-gold/20 shadow-card-lg">

          {/* Logo */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gold/20 border border-gold/40 flex items-center justify-center mx-auto mb-3">
              <Logo size={24} className="text-gold" />
            </div>
            <h1 className="text-2xl font-bold text-ink">TripGenie</h1>
            <p className="text-sm text-muted mt-1">Votre assistant voyage IA</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-parchment-dark rounded-xl mb-6">
            {['login', 'signup'].map(t => (
              <button key={t} onClick={() => { setOnglet(t); setErreur('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                  ${onglet === t ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}>
                {t === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="space-y-3">
            {onglet === 'signup' && (
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Ton prénom" className={classeInput} />
            )}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email" className={classeInput} />
            <input type="password" value={motDePasse} onChange={e => setMotDePasse(e.target.value)}
              placeholder="Mot de passe" className={classeInput}
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          {erreur && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mt-3 text-sm text-coral bg-coral/5 rounded-lg px-3 py-2">
              {erreur}
            </motion.p>
          )}

          <button onClick={submit} disabled={chargement}
            className="btn-primary w-full mt-5 flex items-center justify-center gap-2">
            {chargement
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : onglet === 'login' ? 'Se connecter' : 'Créer mon compte'
            }
          </button>

          <p className="text-center text-xs text-muted mt-4">
            <Link to="/" className="hover:text-ink transition-colors">
              ← Retour à l'accueil
            </Link>
          </p>
        </motion.div>
      </div>
    </PageLayout>
  )
}
