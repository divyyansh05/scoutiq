/**
 * Displays an API error message in a dismissible banner.
 * Renders nothing when error is null/undefined.
 */
export default function ErrorBanner({ error, onClose }) {
  if (!error) return null

  return (
    <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">
      <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
      <span className="flex-1">{error}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 hover:text-red-300 transition-colors"
          aria-label="Dismiss error"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      )}
    </div>
  )
}
