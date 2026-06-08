import { useState } from 'react'
import { saveVote } from '../../lib/api'

const VoteButtons = ({ packId, itemId }: { packId: string, itemId: string }) => {
  const [userVote, setUserVote] = useState<boolean | null>(null)
  const disabled = !packId

  const onVote = async (type: boolean) => {
    if (disabled) return
    try {
      await saveVote(packId, itemId, type, '')
      setUserVote(type)
    } catch (err) { console.error(err) }
  }

  return (
    <div className="flex gap-1.5" data-testid="vote-container" title={disabled ? 'Connectez-vous pour voter' : ''}>
      <button
        onClick={() => onVote(true)}
        disabled={disabled}
        aria-label="Vote positif"
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${disabled ? 'opacity-30 cursor-not-allowed' : ''} ${userVote === true ? 'bg-sage/40 border-sage' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
      >
        👍
      </button>
      <button
        onClick={() => onVote(false)}
        disabled={disabled}
        aria-label="Vote négatif"
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${disabled ? 'opacity-30 cursor-not-allowed' : ''} ${userVote === false ? 'bg-rose-500/20 border-rose-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
      >
        👎
      </button>
    </div>
  )
}

export default VoteButtons
