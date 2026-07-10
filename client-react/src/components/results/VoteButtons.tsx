import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { saveVote, getVotes } from '../../lib/api'

interface TripVote { item_id: string; vote_type: boolean }

const VoteButtons = ({ packId, itemId }: { packId: string, itemId: string }) => {
  const [voteUtilisateur, setVoteUtilisateur] = useState<boolean | null>(null)
  const desactive = !packId
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['votes', packId],
    queryFn: () => getVotes(packId),
    enabled: !!packId,
    refetchInterval: 10000,
  })

  const votes = (data?.votes ?? []) as TripVote[]
  const votesItem = votes.filter(v => v.item_id === itemId)
  const totalPositifs = votesItem.filter(v => v.vote_type === true).length
  const totalNegatifs = votesItem.filter(v => v.vote_type === false).length

  const gererVote = async (estPositif: boolean) => {
    if (desactive) return
    try {
      await saveVote(packId, itemId, estPositif, '')
      setVoteUtilisateur(estPositif)
      queryClient.invalidateQueries({ queryKey: ['votes', packId] })
    } catch (err) { console.error(err) }
  }

  return (
    <div className="flex items-center gap-2" data-testid="vote-container" title={desactive ? 'Connectez-vous pour voter' : ''}>
      <div className="flex items-center gap-1">
        <button
          onClick={() => gererVote(true)}
          disabled={desactive}
          aria-label="Vote positif"
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${desactive ? 'opacity-30 cursor-not-allowed' : ''} ${voteUtilisateur === true ? 'bg-sage/40 border-sage' : 'bg-ink/5 border-ink/10 hover:bg-ink/10'}`}
        >
          👍
        </button>
        {totalPositifs > 0 && (
          <span className="text-xs text-muted font-medium">{totalPositifs}</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => gererVote(false)}
          disabled={desactive}
          aria-label="Vote négatif"
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${desactive ? 'opacity-30 cursor-not-allowed' : ''} ${voteUtilisateur === false ? 'bg-rose-500/20 border-rose-500' : 'bg-ink/5 border-ink/10 hover:bg-ink/10'}`}
        >
          👎
        </button>
        {totalNegatifs > 0 && (
          <span className="text-xs text-muted font-medium">{totalNegatifs}</span>
        )}
      </div>
    </div>
  )
}

export default VoteButtons
