import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import React from 'react'

export { default as GenerationLoader } from './GenerationLoader'

// ---- Skeleton loader ----
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

// ---- Score badge ----
export function ScoreBadge({ score }: { score: any }) {
  const pct   = Math.round((score?.total ?? score ?? 0) * 100)
  const color = pct >= 75 ? 'bg-sage/20 text-sage' : pct >= 50 ? 'bg-gold/20 text-gold-dark' : 'bg-coral/20 text-coral'
  return (
    <span className={clsx('score-badge shadow-glow-gold animate-pulse-gold', color)}>
      ★ {pct}<span className="opacity-60 text-[10px]">/100</span>
    </span>
  )
}

// ---- Verified badge ----
export function VerifiedBadge() {
  return (
    <span className="verified">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Vérifié Booking.com
    </span>
  )
}

// ---- Tab bar ----
export function TabBar({ tabs, active, onChange }: { tabs: any[], active: string, onChange: (id: string) => void }) {
  return (
    <div className="overflow-x-auto scroll-hide -mx-1">
      <div className="flex gap-1 p-1 bg-parchment-dark dark:bg-ink rounded-xl min-w-max mx-1">
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

// ---- Section header ----
export function SectionTitle({ children, sub }: { children: React.ReactNode, sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-display text-xl font-semibold text-ink dark:text-parchment">{children}</h3>
      {sub && <p className="text-sm text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

// ---- Stars ----
export function Stars({ count = 3 }: { count?: number }) {
  return (
    <span className="text-gold text-sm tracking-tight">
      {'★'.repeat(Math.min(count, 5))}
      <span className="opacity-25">{'★'.repeat(5 - Math.min(count, 5))}</span>
    </span>
  )
}

// ---- Animated counter ----
export function AnimatedNumber({ value, suffix = '' }: { value: number, suffix?: string }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="tabular-nums"
    >
      {value?.toLocaleString('fr-FR')}{suffix}
    </motion.span>
  )
}

// ---- Mode badge ----
const MODE_LABELS = {
  party:   { label: 'Fête',      emoji: '🎉', cls: 'bg-coral/10 text-coral' },
  student: { label: 'Étudiant',  emoji: '🎒', cls: 'bg-sky/10 text-sky' },
  luxury:  { label: 'Luxe',      emoji: '💎', cls: 'bg-gold/10 text-gold-dark' },
  group:   { label: 'Groupe',    emoji: '👥', cls: 'bg-sage/10 text-sage' },
  relax:   { label: 'Détente',   emoji: '🌊', cls: 'bg-sky/10 text-sky' },
  surprise:{ label: 'Surprise',  emoji: '✨', cls: 'bg-gold/10 text-gold-dark' },
}

export function ModeBadge({ mode }: { mode: string }) {
  const m = MODE_LABELS[mode as keyof typeof MODE_LABELS] || { label: mode, emoji: '✈️', cls: 'bg-muted/10 text-muted' }
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold', m.cls)}>
      {m.emoji} {m.label}
    </span>
  )
}
