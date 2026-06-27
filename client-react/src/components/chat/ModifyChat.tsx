import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSearchStore } from '../../store'

interface MessageChat {
  role: 'user' | 'assistant'
  text: string
}

interface ModifyChatProps {
  tripId?: string
  mode?: string
}

const SUGGESTIONS = [
  'Hôtel moins cher',
  'Activité premium',
  'Vol direct',
  'Plus d\'activités',
]

export default function ModifyChat({ tripId, mode }: ModifyChatProps) {
  const { pack, setPack } = useSearchStore()
  const [messages, setMessages] = useState<MessageChat[]>([
    { role: 'assistant', text: 'Bonjour ! Que souhaitez-vous modifier dans ce pack ?' }
  ])
  const [input, setInput] = useState('')
  const [chargement, setChargement] = useState(false)
  const refBas = useRef<HTMLDivElement>(null)

  useEffect(() => {
    refBas.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const envoyer = async (text?: string) => {
    const message = (text ?? input).trim()
    if (!message || chargement) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: message }])
    setChargement(true)

    try {
      const reponse = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: message,
          current_pack: pack,
          mode: mode || 'party',
          trip_id: tripId ?? null,
        }),
      })
      const donneesReponse = await reponse.json()
      if (donneesReponse.modifications && pack) {
        setPack({ ...pack, ...donneesReponse.modifications }, tripId ?? null)
      }
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: donneesReponse.reply || 'Modification effectuée ✓' },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: 'Erreur de connexion, réessaie.' },
      ])
    } finally {
      setChargement(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center text-white text-[10px] mr-2 mt-1 flex-shrink-0">
                ✦
              </div>
            )}
            <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-gold text-white rounded-br-sm'
                : 'glass text-ink dark:text-parchment rounded-bl-sm border border-gold/10'
            }`}>
              {m.text}
            </div>
          </motion.div>
        ))}

        {chargement && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center text-white text-[10px] mr-2 mt-1 flex-shrink-0">
              ✦
            </div>
            <div className="glass px-4 py-3 rounded-2xl rounded-bl-sm border border-gold/10">
              <span className="flex gap-1.5 items-center">
                {[0, 150, 300].map(delay => (
                  <span key={delay} className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce"
                    style={{ animationDelay: `${delay}ms` }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={refBas} />
      </div>

      {/* Suggestions rapides */}
      {messages.length === 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => envoyer(s)}
              className="text-[11px] px-3 py-1.5 rounded-full border border-gold/30 text-gold hover:bg-gold/10 transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gold/10 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && envoyer()}
            placeholder="Remplace l'hôtel par..."
            className="flex-1 bg-white/5 border border-gold/20 rounded-xl px-3.5 py-2.5 text-sm
                       text-ink dark:text-parchment placeholder:text-muted
                       focus:outline-none focus:border-gold/50 transition-colors"
          />
          <button
            onClick={() => envoyer()}
            disabled={chargement || !input.trim()}
            className="bg-gold hover:bg-gold/80 disabled:opacity-30 text-white
                       w-10 h-10 rounded-xl font-bold transition-all flex items-center justify-center"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}
