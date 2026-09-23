export default function Spinner({ size = 24, className = '', label }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} role="status" aria-live="polite">
      <svg
        className="animate-spin text-brand-700"
        style={{ width: size, height: size }}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {label ? <span className="text-sm text-gray-600">{label}</span> : null}
    </span>
  )
}
