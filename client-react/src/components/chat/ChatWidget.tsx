import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChatStore, useSearchStore } from '../../store'
import { chatOnboarding, getDestinations } from '../../lib/api'
import Logo from '../ui/Logo'

// ---- FIX 3 : date locale — évite le décalage UTC/local pour les users UTC- ----
// toISOString() retourne UTC ; pour UTC-5 à 23h30, ça donne "demain".
// localDateStr() utilise les méthodes locales du navigateur → toujours le bon jour.
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ajouterJours(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return localDateStr(d)
}

// ---- FIX 6 : utilitaire centralisé — était dupliqué 3 fois ----
function computeReturnDate(departure: string, durationDays: number): string {
  return localDateStr(new Date(new Date(departure).getTime() + durationDays * 86400000))
}

// Formatage du récap
function buildRecapMessage(data: Record<string, unknown>): string {
  const profileMap: Record<string, string> = {
    couple:  'Duo Romantique 💑',
    amis:    'Entre Amis 🥂',
    famille: 'En Famille 👨‍👩‍👧',
    solo:    'Solo & Liberté 🌍',
  }
  const profile   = profileMap[data.profile as string] || (data.profile as string) || '—'
  const travelers = data.travelers
    ? `${data.travelers} personne${(data.travelers as number) > 1 ? 's' : ''}`
    : '—'
  // FIX 5 : budget peut arriver en string depuis l'IA — Number() avant toLocaleString
  const budget = data.budget
    ? `${Number(data.budget).toLocaleString('fr-FR')}€`
    : '—'
  // FIX 5 : departure manquant = avertissement visible, pas '—' silencieux
  const departure = (data.departure as string) || '⚠️ date non définie'
  const duration  = data.duration
    ? `${data.duration} jour${(data.duration as number) > 1 ? 's' : ''}`
    : '—'
  return `Récap de votre voyage :\n• ${profile} — ${travelers}\n• Budget : ${budget}\n• Départ : ${departure}, durée : ${duration}`
}

// QUIZ STEPS
const QUIZ_STEPS = [
  {
    key:      'occasion',
    question: "Quelle est l'occasion de ce voyage ?",
    chips: [
      { label: 'Duo Romantique 💑',    data: { mode: 'relax',   profile: 'couple'  } },
      { label: 'Entre Amis 🥂',       data: { mode: 'party',   profile: 'amis'    } },
      { label: 'En Famille 👨‍👩‍👧',     data: { mode: 'group',   profile: 'famille' } },
      { label: 'Solo & Liberté 🌍',   data: { mode: 'relax',   profile: 'solo'    } },
    ]
  },
  {
    key:      'travelers',
    question: 'Vous serez combien ?',
    chips: [
      { label: '2 personnes',      data: { travelers: 2  } },
      { label: '3-4 personnes',    data: { travelers: 4  } },
      { label: '5-8 personnes',    data: { travelers: 6  } },
      { label: '9+ personnes',     data: { travelers: 10 } },
      { label: 'Autre nombre...', data: null               },
    ]
  },
  {
    key:      'budget',
    question: 'Quel budget pour ce voyage ?',
    chips: [
      { label: 'Dès 1 500€',         data: { budget: 1500  } },
      { label: 'Environ 5 000€',     data: { budget: 5000  } },
      { label: '10 000€ et +',       data: { budget: 15000 } },
      { label: '✏️ Montant précis...', data: null },
    ]
  },
  {
    key:      'departure',
    question: 'Quand souhaitez-vous partir ?',
    chips: [
      { label: 'Ce week-end',        data: () => ({ departure: ajouterJours(3),   return_date: ajouterJours(5),   duration: 2  }) },
      { label: 'Dans 1 mois',        data: () => ({ departure: ajouterJours(30),  return_date: ajouterJours(37),  duration: 7  }) },
      { label: 'Dans 3 mois',        data: () => ({ departure: ajouterJours(90),  return_date: ajouterJours(97),  duration: 7  }) },
      { label: 'Dans 6 mois',        data: () => ({ departure: ajouterJours(180), return_date: ajouterJours(187), duration: 7  }) },
      { label: '📅 Date précise...', data: null },
    ]
  },
  {
    key:      'duration',
    question: 'Pour combien de temps ?',
    chips: [
      { label: 'Un week-end (2-3j)', data: { duration: 2  } },
      { label: '1 semaine',          data: { duration: 7  } },
      { label: '2 semaines',         data: { duration: 14 } },
      { label: '3 semaines et +',    data: { duration: 21 } },
    ]
  },
]

// Typing indicator
function TypingDots() {
  return (
    <div className="flex items-end gap-1.5 px-4 py-3">
      {[0,1,2].map(i => (
        <span key={i} className="typing-dot w-2 h-2 rounded-full bg-gold/60 inline-block"
          style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  )
}

// Message bubble
function Message({ msg, onChipClick }: { msg: any; onChipClick?: (label: string) => void }) {
  const isBot = msg.role === 'bot' || msg.role === 'assistant'
  return (
    <motion.div
      className={`flex gap-2 ${isBot ? 'justify-start' : 'justify-end'} msg-enter`}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.34,1.2,0.64,1] }}
    >
      {isBot && (
        <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0 mt-1">
          <Logo size={15} className="text-gold" />
        </div>
      )}
      <div className={`max-w-[78%] flex flex-col gap-2 ${isBot ? 'items-start' : 'items-end'}`}>
        <div className={isBot ? 'bubble-bot' : 'bubble-user'} style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
        {isBot && msg.chips?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {msg.chips.map((c: string | { label: string }, i: number) => {
              const label = typeof c === 'string' ? c : c.label
              return onChipClick ? (
                <button key={i} onClick={() => onChipClick(label)}
                  className="chip text-sm hover:border-gold/60 hover:bg-gold/10 active:scale-95 transition-all cursor-pointer">
                  {label}
                </button>
              ) : (
                <StaticChip key={i} label={label} />
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function StaticChip({ label }: { label: string }) {
  return <span className="chip text-sm opacity-60 cursor-default">{label}</span>
}

// Composant input inline
function InlineInput({
  mode,
  dateRange,
  setDateRange,
  travelersCount,
  setTravelersCount,
  budgetAmount,
  setBudgetAmount,
  onConfirm,
  onCancel,
}: {
  mode: 'date' | 'travelers' | 'budget'
  dateRange: { departure: string; return_date: string }
  setDateRange: (v: { departure: string; return_date: string }) => void
  travelersCount: number | ''
  setTravelersCount: (v: number | '') => void
  budgetAmount: number | ''
  setBudgetAmount: (v: number | '') => void
  onConfirm: () => void
  onCancel: () => void
}) {
  // FIX 3 : date locale — pas de décalage UTC pour les users Americas
  const today = localDateStr(new Date())

  const canConfirm = mode === 'date'
    ? !!dateRange.departure
    : mode === 'travelers'
    ? travelersCount !== '' && (travelersCount as number) >= 1
    : budgetAmount !== '' && (budgetAmount as number) >= 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 pl-9 pr-4">
      {mode === 'date' ? (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-gold font-semibold">Date de départ</label>
            <input
              type="date"
              min={today}
              value={dateRange.departure}
              onChange={e => setDateRange({ ...dateRange, departure: e.target.value })}
              className="bg-ink/5 dark:bg-white/5 border border-gold/30 focus:border-gold/70 rounded-xl px-3 py-2 text-sm text-ink dark:text-parchment outline-none transition-colors w-44"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-gold font-semibold">
              Date de retour <span className="text-muted normal-case">(optionnel)</span>
            </label>
            <input
              type="date"
              min={dateRange.departure || today}
              value={dateRange.return_date}
              onChange={e => setDateRange({ ...dateRange, return_date: e.target.value })}
              className="bg-ink/5 dark:bg-white/5 border border-gold/30 focus:border-gold/70 rounded-xl px-3 py-2 text-sm text-ink dark:text-parchment outline-none transition-colors w-44"
            />
          </div>
        </>
      ) : mode === 'travelers' ? (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-widest text-gold font-semibold">Nombre de voyageurs</label>
          <input
            type="number"
            min={1}
            max={50}
            placeholder="Ex : 7"
            value={travelersCount}
            onChange={e => setTravelersCount(
              e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 1)
            )}
            className="bg-ink/5 dark:bg-white/5 border border-gold/30 focus:border-gold/70 rounded-xl px-3 py-2 text-sm text-ink dark:text-parchment outline-none transition-colors w-32"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-widest text-gold font-semibold">Budget total (€)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={50000}
              step={500}
              placeholder="Ex : 8 000"
              value={budgetAmount}
              onChange={e => setBudgetAmount(
                e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 1)
              )}
              className="bg-ink/5 dark:bg-white/5 border border-gold/30 focus:border-gold/70 rounded-xl px-3 py-2 text-sm text-ink dark:text-parchment outline-none transition-colors w-32"
            />
            <span className="text-gold text-sm font-semibold">€</span>
          </div>
        </div>
      )}
      <div className="flex gap-2 mt-1">
        <button onClick={onConfirm} disabled={!canConfirm}
          className="chip text-sm hover:border-gold/60 hover:bg-gold/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          Confirmer ✓
        </button>
        <button onClick={onCancel}
          className="chip text-sm opacity-60 hover:opacity-100 transition-all">
          ← Retour
        </button>
      </div>
    </motion.div>
  )
}

// =============================================
// LOGIQUE TEXTE LIBRE (IA parsing)
// =============================================
async function traiterMessageIA(value: string, ctx: any) {
  const { addMessage, mergeChatData, setTyping, setReady, setMockMode,
          setLoading, setPack, setField, chatData, turnCount } = ctx
  const forceReady = turnCount >= 5
  try {
    setTyping(true)
    const reponse = await chatOnboarding(value, chatData)
    setTyping(false)
    if (reponse.isMock) setMockMode(true)
    if (reponse.extractedData) mergeChatData(reponse.extractedData)
    const merged = { ...chatData, ...(reponse.extractedData || {}) }
    if (reponse.isReady || forceReady) {
      setReady(true)
      addMessage({ role: 'bot', text: "🎯 Parfait, j'ai tout ce qu'il me faut ! Je cherche les meilleures destinations pour vous..." })
      await suggestDestinations(merged, { addMessage, setTyping, setLoading, setPack, setField, setReady })
    } else {
      addMessage({ role: 'bot', text: reponse.response, chips: reponse.chips || [] })
    }
  } catch {
    setTyping(false)
    addMessage({ role: 'bot', text: 'Oups, petit souci technique. Réessaie !' })
  }
}

// SUGGESTION DESTINATIONS
async function suggestDestinations(
  chatData: any,
  ctx: any,
  // FIX 11 : guard montage pour éviter les setField sur composant démonté
  guard?: { mounted: { current: boolean } }
) {
  const { addMessage, setTyping, setLoading, setPack, setField, setReady } = ctx
  setTyping(true)
  try {
    const reponse = await getDestinations({
      mode:        chatData.mode,
      profile:     chatData.profile,
      budget:      chatData.budget,
      travelers:   chatData.travelers,
      duration:    chatData.duration,
      origin:      chatData.origin || 'Paris',
      departure:   chatData.departure,
      preferences: [],
    })
    if (guard && !guard.mounted.current) return
    setTyping(false)
    const destinations = reponse.destinations || []
    if (destinations.length) {
      setField('concepts', destinations)
    } else {
      // Échec : on rouvre l'UI quiz (setReady=false) pour permettre un retry.
      setReady?.(false)
      addMessage({ role: 'bot', text: 'Impossible de charger les destinations. Réessaie !' })
    }
  } catch {
    if (guard && !guard.mounted.current) return
    setTyping(false)
    setReady?.(false)
    addMessage({ role: 'bot', text: 'Impossible de charger les destinations. Réessaie !' })
  }
}

// MAIN CHAT WIDGET
export default function ChatWidget() {
  const {
    messages, isTyping, addMessage, mergeChatData, setTyping,
    setReady, setMockMode, chatData, turnCount, isMockMode, isReady,
    quizMode, quizStep, setQuizMode, nextQuizStep,
  } = useChatStore()
  const { setLoading, setPack, setField } = useSearchStore()

  const [input, setInput]   = useState('')
  // FIX 12 : sendingRef = ref pour éviter la race condition sendMessage/sendChip
  const sendingRef          = useRef(false)
  const [sending, setSending] = useState(false) // pour l'UI (spinner)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [inputMode, setInputMode]             = useState<null | 'date' | 'travelers' | 'budget'>(null)
  const [dateRange, setDateRange]             = useState({ departure: '', return_date: '' })
  const [travelersCount, setTravelersCount]   = useState<number | ''>('')
  const [budgetAmount, setBudgetAmount]       = useState<number | ''>('')

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const initRef    = useRef<boolean>(false)
  // FIX 11 : ref de montage — empêche setField sur composant démonté.
  // ⚠️ On REMET à true à chaque (re)montage : en React.StrictMode (dev), le cycle
  // mount→unmount→remount laisserait sinon mountedRef à false → le guard bloquerait
  // setField('concepts') et les cartes n'apparaîtraient jamais ("ça charge, rien n'arrive").
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Message de bienvenue
  useEffect(() => {
    if (messages.length === 0 && !initRef.current) {
      initRef.current = true
      setTimeout(() => {
        addMessage({
          role: 'bot',
          text: 'Bienvenue sur TripGenie. Décrivez votre voyage en une phrase, je m\'occupe du reste.',
          chips: [],
        })
      }, 500)
    }
  }, [])

  // FIX 2 : réinitialiser les états locaux quand resetChat() est appelé (messages vidés)
  useEffect(() => {
    if (messages.length === 0) {
      setAwaitingConfirm(false)
      setInputMode(null)
      setDateRange({ departure: '', return_date: '' })
      setTravelersCount('')
      setBudgetAmount('')
    }
  }, [messages.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Handler chip quiz
  const handleQuizChip = useCallback(async (chip: any) => {
    // Chip d'input inline (data === null)
    if (chip.data === null) {
      if (chip.label.includes('Date précise'))   setInputMode('date')
      if (chip.label.includes('Autre nombre'))   setInputMode('travelers')
      if (chip.label.includes('Montant précis')) setInputMode('budget')
      return
    }

    const chipData = typeof chip.data === 'function' ? chip.data() : chip.data
    addMessage({ role: 'user', text: chip.label })

    mergeChatData(chipData)

    const currentStep = QUIZ_STEPS[quizStep]
    const isLast      = quizStep === QUIZ_STEPS.length - 1
    // Les chips rapides de l'étape "departure" (Ce week-end, Dans 1 mois…) fournissent
    // DÉJÀ la durée → inutile de redemander l'étape "duration" : on file au récap.
    const departureProvidesDuration = currentStep.key === 'departure' && chipData?.duration != null

    // FIX 6 : recalcul return_date via utilitaire centralisé
    if (currentStep.key === 'duration' && chipData?.duration && chatData.departure) {
      mergeChatData({ return_date: computeReturnDate(chatData.departure as string, chipData.duration as number) })
    }

    if (isLast || departureProvidesDuration) {
      if (departureProvidesDuration) nextQuizStep() // step 3 → 4 (durée) pour cohérence d'état
      const merged: Record<string, unknown> = { ...chatData, ...chipData }
      if (merged.departure && merged.duration) {
        merged.return_date = computeReturnDate(merged.departure as string, merged.duration as number)
      }
      setAwaitingConfirm(true)
      setTimeout(() => addMessage({ role: 'bot', text: buildRecapMessage(merged), chips: [] }), 200)
    } else {
      nextQuizStep()
      const next = QUIZ_STEPS[quizStep + 1]
      setTimeout(() => addMessage({ role: 'bot', text: next.question }), 300)
    }
  // FIX 9 : awaitingConfirm retiré des deps (non lu dans le corps du callback)
  }, [quizStep, chatData])

  // Confirmation récap
  const handleConfirm = useCallback(async () => {
    setAwaitingConfirm(false)
    const merged: Record<string, unknown> = { ...chatData }
    if (merged.departure && merged.duration) {
      merged.return_date = computeReturnDate(merged.departure as string, merged.duration as number)
    }

    // FIX 5 : validation departure avant d'envoyer à l'IA
    if (!merged.departure) {
      setAwaitingConfirm(true)
      setTimeout(() => addMessage({
        role: 'bot',
        text: "⚠️ Il manque la date de départ. Cliquez sur ✏️ Modifier pour la renseigner.",
      }), 100)
      return
    }

    addMessage({ role: 'user', text: "C'est parfait !" })
    setTimeout(() => addMessage({ role: 'bot', text: '🎯 Parfait ! Je cherche les meilleures destinations pour votre voyage...' }), 200)
    setReady(true)
    // FIX 11 : passage du guard de montage
    await suggestDestinations(merged, { addMessage, setTyping, setLoading, setPack, setField, setReady }, { mounted: mountedRef })
  }, [chatData])

  // ---- Modifier → reset chatData + retour step 0 ----
  const handleModify = useCallback(() => {
    setAwaitingConfirm(false)
    // FIX 7 : réinitialiser chatData pour éviter les données fantômes du quiz précédent
    mergeChatData({ travelers: null, profile: null, mode: 'party', budget: null, departure: null, return_date: null, duration: null })
    setQuizMode(true) // reset quizStep = 0
    setTimeout(() => addMessage({ role: 'bot', text: QUIZ_STEPS[0].question }), 200)
  }, [])

  // Confirm input inline
  const handleInlineConfirm = useCallback(async () => {
    // FIX 4 : try/finally — inputMode toujours réinitialisé même en cas d'exception
    try {
      if (inputMode === 'date') {
        const dateDepart = dateRange.departure
        const dateRetour = dateRange.return_date
        if (!dateDepart) return
        const durationDays = dateRetour
          ? Math.max(1, Math.round((new Date(dateRetour).getTime() - new Date(dateDepart).getTime()) / 86400000))
          : 7

        const label = `Du ${dateDepart}${dateRetour ? ` au ${dateRetour}` : ''}`
        addMessage({ role: 'user', text: label })
        mergeChatData({ departure: dateDepart, return_date: computeReturnDate(dateDepart, durationDays), duration: durationDays })

        // FIX 1 : ne pas déléguer à handleQuizChip (quizStep=3 → isLast=false → step duration redemandé)
        // On avance quizStep jusqu'au dernier step et on déclenche le récap directement
        nextQuizStep() // step 3 → 4 (duration, le dernier)
        const merged: Record<string, unknown> = {
          ...chatData,
          departure:   dateDepart,
          return_date: computeReturnDate(dateDepart, durationDays),
          duration:    durationDays,
        }
        setAwaitingConfirm(true)
        setTimeout(() => addMessage({ role: 'bot', text: buildRecapMessage(merged), chips: [] }), 300)

      } else if (inputMode === 'travelers') {
        // FIX 8 : !travelersCount est faux positif sur 0 → guard explicite
        if (travelersCount === '') return
        await handleQuizChip({
          label: `${travelersCount} personne${(travelersCount as number) > 1 ? 's' : ''}`,
          data:  { travelers: travelersCount },
        })
      } else if (inputMode === 'budget') {
        // Budget exact saisi à la main — délégué comme un chip budget normal
        if (budgetAmount === '') return
        await handleQuizChip({
          label: `${Number(budgetAmount).toLocaleString('fr-FR')}€`,
          data:  { budget: budgetAmount },
        })
      }
    } catch {
      // FIX 4 : en cas d'erreur, on informe sans bloquer l'UI
      addMessage({ role: 'bot', text: 'Une erreur est survenue. Réessaie !' })
    } finally {
      // FIX 4 : toujours nettoyer l'état inline
      setInputMode(null)
      setDateRange({ departure: '', return_date: '' })
      setTravelersCount('')
      setBudgetAmount('')
    }
  }, [inputMode, dateRange, travelersCount, budgetAmount, handleQuizChip, chatData])

  // Envoi texte libre
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    // FIX 12 : sendingRef.current = toujours à jour (pas de stale closure comme avec le state)
    if (!text || sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setInput('')
    addMessage({ role: 'user', text })
    try {
      await traiterMessageIA(text, {
        addMessage, mergeChatData, setTyping, setReady, setMockMode,
        setLoading, setPack, setField, chatData, turnCount,
      })
    } finally {
      sendingRef.current = false
      setSending(false)
      inputRef.current?.focus()
    }
  }, [input, chatData, turnCount])

  // Clic sur un chip de réponse bot
  const sendChip = useCallback(async (label: string) => {
    // FIX 12 : sendingRef empêche la race condition avec sendMessage
    if (sendingRef.current || isTyping) return
    sendingRef.current = true
    setSending(true)
    addMessage({ role: 'user', text: label })
    try {
      await traiterMessageIA(label, {
        addMessage, mergeChatData, setTyping, setReady, setMockMode,
        setLoading, setPack, setField, chatData, turnCount,
      })
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }, [isTyping, chatData, turnCount])

  const onKey = (e: any) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // Choix du mode au démarrage
  const handleModeSelect = useCallback((mode: string) => {
    if (mode === 'quiz') {
      addMessage({ role: 'user', text: 'Questionnaire guidé' })
      setQuizMode(true)
      setTimeout(() => addMessage({ role: 'bot', text: QUIZ_STEPS[0].question }), 300)
    } else {
      addMessage({ role: 'user', text: 'Je décris mon voyage' })
      setQuizMode(false)
      setTimeout(() => addMessage({
        role: 'bot',
        text: 'Décrivez-moi votre voyage en une phrase — je m\'occupe du reste.\nEx : "4 amis, fête, du 15/06 au 21/06, départ Bordeaux, budget 16 000€"',
      }), 300)
    }
  }, [])

  const isWelcomeState = messages.length === 1 && messages[0].role === 'bot' && !quizMode

  return (
    <div className="flex flex-col h-full">
      <AnimatePresence>
        {isMockMode && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-4 mt-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40
                       rounded-lg text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <span>⚡</span> Mode démonstration actif (quotas IA saturés)
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-hide px-4 py-4 flex flex-col gap-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isLastBot = idx === messages.length - 1
              && (msg.role === 'bot' || msg.role === 'assistant')
              && !quizMode
              && !sending
              && !isTyping
            return (
              <Message key={msg.id} msg={msg} onChipClick={isLastBot ? sendChip : undefined} />
            )
          })}
        </AnimatePresence>

        {/* Choix de mode (accueil) */}
        {isWelcomeState && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-2 pl-9">
            <button onClick={() => handleModeSelect('quiz')}
              className="chip text-sm text-left hover:border-gold/60 hover:bg-gold/10 transition-all">
              Définir mes préférences (guidé)
            </button>
            <button onClick={() => handleModeSelect('freeform')}
              className="chip text-sm text-left hover:border-gold/60 hover:bg-gold/10 transition-all">
              Décrire mon voyage (libre)
            </button>
          </motion.div>
        )}

        {/* Quiz : input inline OU chips OU récap — masqué dès que l'onboarding
            est validé (isReady) pour ne pas laisser traîner de chips pendant
            le chargement des destinations. */}
        {quizMode && !isWelcomeState && !isReady && (
          <>
            {inputMode ? (
              <InlineInput
                mode={inputMode}
                dateRange={dateRange}
                setDateRange={setDateRange}
                travelersCount={travelersCount}
                setTravelersCount={setTravelersCount}
                budgetAmount={budgetAmount}
                setBudgetAmount={setBudgetAmount}
                onConfirm={handleInlineConfirm}
                onCancel={() => setInputMode(null)}
              />
            ) : awaitingConfirm ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap gap-2 pl-9">
                <button onClick={handleModify}
                  className="chip text-sm hover:border-gold/60 hover:bg-gold/10 transition-all">
                  ✏️ Modifier
                </button>
                <button onClick={handleConfirm} disabled={isTyping}
                  className="chip text-sm hover:border-gold/60 hover:bg-gold/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  C'est parfait →
                </button>
              </motion.div>
            ) : (
              <QuizChips step={quizStep} onSelect={handleQuizChip} disabled={isTyping} />
            )}
          </>
        )}

        <AnimatePresence>
          {isTyping && (
            <motion.div className="flex gap-2 justify-start"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0 mt-1">
                <Logo size={15} className="text-gold" />
              </div>
              <div className="bubble-bot"><TypingDots /></div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input texte libre (mode freeform uniquement) */}
      {!quizMode && (
        <div className="px-4 pb-4 pt-2">
          <div className="flex gap-2 items-end bg-white/60 dark:bg-ink-light/40 backdrop-blur-md border border-gold/20 rounded-2xl p-1 shadow-inner">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Décrivez votre voyage en une phrase..."
              rows={1}
              className="flex-1 resize-none bg-transparent border-none
                         px-4 py-3 text-[15px] text-ink dark:text-parchment placeholder:text-muted/60
                         focus:outline-none focus:ring-0 transition-all duration-200 max-h-32 overflow-y-auto scroll-hide leading-relaxed"
              style={{ minHeight: '48px' }}
              onInput={(e: React.FormEvent<HTMLTextAreaElement>) => {
                e.currentTarget.style.height = 'auto'
                e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 128) + 'px'
              }}
            />
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="w-11 h-11 rounded-xl bg-gold text-white flex items-center justify-center
                         disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gold-dark
                         transition-all duration-200 flex-shrink-0 shadow-glow-gold hover:shadow-none">
              {sending
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <SendIcon />}
            </motion.button>
          </div>
        </div>
      )}
    </div>
  )
}

// Quiz chips
function QuizChips({ step, onSelect, disabled }: { step: number; onSelect: (chip: any) => void; disabled: boolean }) {
  const currentStep = QUIZ_STEPS[step]
  if (!currentStep) return null
  return (
    <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap gap-2 pl-9">
      {currentStep.chips.map((chip, i) => (
        <button key={i} onClick={() => !disabled && onSelect(chip)} disabled={disabled}
          className="chip text-sm hover:border-gold/60 hover:bg-gold/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          {chip.label}
        </button>
      ))}
    </motion.div>
  )
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}
