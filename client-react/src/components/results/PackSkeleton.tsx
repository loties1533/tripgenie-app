import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Images et textes qui défilent pendant le chargement
const LOADING_SLIDES = [
  {
    img: "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1920&q=80",
    text: "Sélection des meilleurs établissements...",
    sub: "Nos algorithmes analysent 10 000 avis d'experts"
  },
  {
    img: "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1920&q=80",
    text: "Coordination avec nos partenaires VIP...",
    sub: "Accès à des expériences non répertoriées au grand public"
  },
  {
    img: "https://images.unsplash.com/photo-1549294413-26f195200c16?auto=format&fit=crop&w=1920&q=80",
    text: "Optimisation de votre itinéraire...",
    sub: "Chaque heure de votre séjour est pensée"
  },
  {
    img: "https://images.unsplash.com/photo-1519659528534-7fd733a832a0?auto=format&fit=crop&w=1920&q=80",
    text: "Recherche des soirées et événements exclusifs...",
    sub: "Notre IA parcourt le web pour trouver les meilleures tables"
  },
  {
    img: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1920&q=80",
    text: "Finalisation de votre Pack Signature...",
    sub: "Dernière vérification par votre concierge dédié"
  }
]

export default function PackSkeleton() {
  const [current, setCurrent] = useState(0)
  const [progress, setProgress] = useState(0)

  // Auto-avancement des slides (changement toutes les 6s)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent(prev => (prev + 1) % LOADING_SLIDES.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  // Barre de progression qui avance lentement (120s max, ~30s en général)
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return 95 // Jamais à 100 avant que le résultat arrive
        return prev + 0.4
      })
    }, 200)
    return () => clearInterval(timer)
  }, [])

  const slide = LOADING_SLIDES[current]

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-ink">

      {/* Background image qui change */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}>
          <img
            src={slide.img}
            alt="loading"
            className="w-full h-full object-cover"
          />
          {/* Overlay noir profond */}
          <div className="absolute inset-0 bg-ink/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/60" />
        </motion.div>
      </AnimatePresence>

      {/* Contenu centré */}
      <div className="relative z-10 text-center px-8 max-w-2xl mx-auto">
        {/* Logo animé */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 mx-auto mb-10 rounded-full border border-gold/30 flex items-center justify-center">
          <span className="text-gold text-2xl">✦</span>
        </motion.div>

        {/* Badge */}
        <p className="text-[10px] uppercase tracking-[0.4em] text-gold font-semibold mb-6">
          TripGenie — Génération en cours
        </p>

        {/* Texte principal qui change */}
        <AnimatePresence mode="wait">
          <motion.h2
            key={current + 'text'}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.6 }}
            className="font-display text-3xl sm:text-4xl text-white font-bold mb-4 leading-snug">
            {slide.text}
          </motion.h2>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.p
            key={current + 'sub'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-parchment/50 text-sm font-light italic tracking-wide">
            {slide.sub}
          </motion.p>
        </AnimatePresence>

        {/* Barre de progression */}
        <div className="mt-12 w-full max-w-xs mx-auto">
          <div className="h-px w-full bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-gold-dark via-gold to-gold-light rounded-full"
              style={{ width: `${progress}%` }}
              transition={{ ease: 'linear' }}
            />
          </div>
          <p className="text-[10px] text-white/30 mt-3 tracking-widest uppercase">
            {Math.round(progress)}% — Préparation en cours
          </p>
        </div>

        {/* Points d'étape */}
        <div className="flex justify-center gap-2 mt-8">
          {LOADING_SLIDES.map((_, i) => (
            <span key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${i === current ? 'bg-gold w-4' : 'bg-white/20'}`}
            />
          ))}
        </div>
      </div>

      {/* Quote en bas */}
      <div className="absolute bottom-10 left-0 right-0 text-center z-10">
        <p className="text-white/20 text-xs font-serif italic tracking-wider">
          "Le luxe, c'est quand l'argent n'est plus une question."
        </p>
      </div>
    </div>
  )
}
