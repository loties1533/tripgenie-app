import { clsx } from 'clsx'
import React from 'react'

export { default as GenerationLoader } from './GenerationLoader'

// Skeleton loader
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />
}

export function SkeletonCard() {
  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
    </div>
  )
}

// Tab bar
export function TabBar({ tabs, active, onChange }: { tabs: any[], active: string, onChange: (id: string) => void }) {
  return (
    <div className="overflow-x-auto scroll-hide -mx-1">
      <div className="flex gap-1 p-1 bg-parchment-dark rounded-xl min-w-max mx-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => onChange(t.id)}
            className={clsx('tab-btn flex items-center justify-center gap-1.5 whitespace-nowrap', active === t.id && 'active')}>
            {t.icon && <span>{t.icon}</span>}
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden text-[10px] font-bold uppercase tracking-tight">{t.label.slice(0, 4)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Section header
export function SectionTitle({ children, sub }: { children: React.ReactNode, sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-xl font-semibold text-ink">{children}</h3>
      {sub && <p className="text-sm text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

// Mode badge — palette unique (couleur distincte par mode, lisible en clair ET sombre)
const MODE_LABELS = {
  party:   { label: 'Fête',      emoji: '🥂', cls: 'bg-rose-500/15 text-rose-600' },
  student: { label: 'Étudiant',  emoji: '🎒', cls: 'bg-sky-500/15 text-sky-600' },
  group:   { label: 'Groupe',    emoji: '👥', cls: 'bg-emerald-500/15 text-emerald-600' },
  relax:   { label: 'Détente',   emoji: '🌿', cls: 'bg-teal-500/15 text-teal-600' },
  surprise:{ label: 'Surprise',  emoji: '🎁', cls: 'bg-violet-500/15 text-violet-600' },
}

// premium : niveau de prix (axe indépendant du mode) → petit badge doré en plus.
export function ModeBadge({ mode, premium }: { mode: string; premium?: boolean }) {
  const infoMode = MODE_LABELS[mode as keyof typeof MODE_LABELS] || { label: mode, emoji: '✈️', cls: 'bg-muted/10 text-muted' }
  return (
    <span className="inline-flex items-center gap-1">
      <span className={clsx('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold', infoMode.cls)}>
        {infoMode.emoji} {infoMode.label}
      </span>
      {premium && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600">
          💎 Premium
        </span>
      )}
    </span>
  )
}
