const COLORS = {
  FWD: 'bg-red-500/10 text-red-400',
  WNG: 'bg-amber-500/10 text-amber-400',
  MID: 'bg-emerald-500/10 text-emerald-400',
  DEF: 'bg-blue-500/10 text-blue-400',
  GK:  'bg-purple-500/10 text-purple-400',
}

export default function PositionBadge({ position, className = '' }) {
  const pos = (position || 'MID').toUpperCase()
  const color = COLORS[pos] || 'bg-surface-variant text-on-surface-variant'
  return (
    <span className={`px-2 py-0.5 ${color} text-[10px] font-bold rounded-full uppercase tracking-tight ${className}`}>
      {pos}
    </span>
  )
}
