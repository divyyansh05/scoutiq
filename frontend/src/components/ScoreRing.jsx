export default function ScoreRing({ score = 0, size = 48, strokeWidth = 6 }) {
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference

  let color = '#ef4444' // red < 45
  if (score >= 80) color = '#22c55e'       // green
  else if (score >= 65) color = '#3b82f6'  // blue
  else if (score >= 45) color = '#f59e0b'  // amber

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="transparent"
          stroke="#192540"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-headline font-bold leading-none"
          style={{ fontSize: size * 0.28, color }}
        >
          {Math.round(score)}
        </span>
      </div>
    </div>
  )
}
