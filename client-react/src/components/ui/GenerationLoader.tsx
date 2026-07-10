import { useEffect, useState } from 'react'

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
    <div
      className="max-w-lg mx-auto mt-8 px-4"
    >
      {/* Card principale */}
      <div className="glass-premium rounded-md p-8 border border-gold/20">

        {/* Destination + icône animée */}
        <div className="text-center mb-8">
          <div
            className="text-5xl mb-3"
          >
            {STEPS[currentStep]?.icon}
          </div>
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
              <div
                key={i}
                className="flex items-center gap-3"
              >
                {/* Icône état */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm transition-all duration-500 ${
                  done   ? 'bg-emerald-500/20 text-emerald-400' :
                  active ? 'bg-gold/20 text-gold' :
                  'bg-white/5 text-muted'
                }`}>
                  {done ? '✓' : active ? (
                    <span
                    >●</span>
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
                  <div
                    className="ml-auto w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full flex-shrink-0"
                  />
                )}
                {done && (
                  <span className="ml-auto text-xs text-emerald-400">✓</span>
                )}
              </div>
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
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-light to-gold transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Tip rotatif */}
        <div className="h-8 flex items-center justify-center">
          
            <p
              key={tipIndex}
              className="text-xs text-muted text-center italic"
            >
              {TIPS[tipIndex]}
            </p>
          
        </div>
      </div>
    </div>
  )
}
