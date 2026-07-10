import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const STEPS = [
  { icon: '✈️', label: 'Recherche des vols',         duration: 8000  },
  { icon: '🏨', label: 'Sélection des hôtels',       duration: 8000  },
  { icon: '🎟️', label: 'Découverte des événements',  duration: 8000  },
  { icon: '🍽️', label: 'Meilleurs restaurants',      duration: 6000  },
  { icon: '📦',  label: 'Assemblage de votre pack',    duration: 12000 },
  { icon: '✓',  label: 'Finalisation',                duration: 8000  },
]

const TIPS = [
  'On passe les options au crible…',
  'On garde les meilleures adresses',
  'On compare les vols et les hébergements',
  'On cherche les pépites moins connues',
  'Presque prêt…',
]

export default function GenerationLoader({ destination }: { destination?: string }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [tipIndex, setTipIndex]       = useState(0)
  const [elapsed, setElapsed]         = useState(0)

  // Avancement automatique des étapes selon leur durée
  useEffect(() => {
    let step = 0
    const timers: ReturnType<typeof setTimeout>[] = []

    let cumulative = 0
    STEPS.forEach((s, i) => {
      cumulative += s.duration
      const t = setTimeout(() => {
        step = i + 1
        setCurrentStep(Math.min(step, STEPS.length - 1))
      }, cumulative)
      timers.push(t)
    })

    return () => timers.forEach(clearTimeout)
  }, [])

  // Rotation des tips toutes les 5s
  useEffect(() => {
    const t = setInterval(() => {
      setTipIndex(i => (i + 1) % TIPS.length)
    }, 5000)
    return () => clearInterval(t)
  }, [])

  // Compteur de secondes
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const totalDuration = STEPS.reduce((a, s) => a + s.duration, 0)
  const progress = Math.min(
    STEPS.slice(0, currentStep + 1).reduce((a, s) => a + s.duration, 0) / totalDuration * 100,
    95
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto mt-8 px-4"
    >
      {/* Card principale */}
      <div className="glass-premium rounded-3xl p-8 border border-gold/20 shadow-glow-gold">

        {/* Destination + icône animée */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            className="text-5xl mb-3"
          >
            {STEPS[currentStep]?.icon}
          </motion.div>
          <h3 className="text-xl font-bold text-ink">
            {destination ? `Votre pack ${destination}` : 'Votre pack'}
          </h3>
          <p className="text-sm text-muted mt-1">est en cours de création…</p>
        </div>

        {/* Étapes */}
        <div className="space-y-3 mb-7">
          {STEPS.map((step, i) => {
            const done    = i < currentStep
            const active  = i === currentStep
            const pending = i > currentStep
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: pending ? 0.35 : 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3"
              >
                {/* Icône état */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm transition-all duration-500 ${
                  done   ? 'bg-emerald-500/20 text-emerald-400' :
                  active ? 'bg-gold/20 text-gold' :
                  'bg-white/5 text-muted'
                }`}>
                  {done ? '✓' : active ? (
                    <motion.span
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                    >●</motion.span>
                  ) : '○'}
                </div>

                {/* Label */}
                <span className={`text-sm font-medium transition-colors duration-300 ${
                  done   ? 'text-emerald-400 line-through decoration-emerald-400/50' :
                  active ? 'text-gold font-semibold' :
                  'text-muted'
                }`}>
                  {step.icon} {step.label}
                </span>

                {/* Spinner sur l'étape active */}
                {active && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                    className="ml-auto w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full flex-shrink-0"
                  />
                )}
                {done && (
                  <span className="ml-auto text-xs text-emerald-400">✓</span>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Barre de progression */}
        <div className="mb-5">
          <div className="flex justify-between text-[10px] text-muted mb-1.5">
            <span>Progression</span>
            <span>{elapsed}s</span>
          </div>
          <div className="h-1.5 rounded-full bg-ink/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-gold-light to-gold"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Tip rotatif */}
        <div className="h-8 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={tipIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4 }}
              className="text-xs text-muted text-center italic"
            >
              {TIPS[tipIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
