import { useState } from 'react'
import { saveVote } from '../../lib/api'

const VoteButtons = ({ packId, itemId }: { packId: string, itemId: string }) => {
  const [voteUtilisateur, setVoteUtilisateur] = useState<boolean | null>(null)
  const desactive = !packId

  const gererVote = async (estPositif: boolean) => {
    if (desactive) return
    try {
      await saveVote(packId, itemId, estPositif, '')
      setVoteUtilisateur(estPositif)
    } catch (err) { console.error(err) }
  }

  return (
    <div className="flex gap-1.5" data-testid="vote-container" title={desactive ? 'Connectez-vous pour voter' : ''}>
      <button
        onClick={() => gererVote(true)}
        disabled={desactive}
        aria-label="Vote positif"
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${desactive ? 'opacity-30 cursor-not-allowed' : ''} ${voteUtilisateur === true ? 'bg-sage/40 border-sage' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
      >
        👍
      </button>
      <button
        onClick={() => gererVote(false)}
        disabled={desactive}
        aria-label="Vote négatif"
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${desactive ? 'opacity-30 cursor-not-allowed' : ''} ${voteUtilisateur === false ? 'bg-rose-500/20 border-rose-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
      >
        👎
      </button>
    </div>
  )
}

export default VoteButtons
