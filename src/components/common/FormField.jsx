export function Label({ children, required }) {
  return (
    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
    </label>
  )
}

const inputBase =
  'w-full rounded-xl border border-gray-300 px-4 py-2.5 text-base text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-100'

export function Input({ label, required, className = '', ...props }) {
  return (
    <div className={className}>
      {label ? <Label required={required}>{label}</Label> : null}
      <input className={inputBase} {...props} />
    </div>
  )
}

export function Textarea({ label, required, className = '', rows = 3, ...props }) {
  return (
    <div className={className}>
      {label ? <Label required={required}>{label}</Label> : null}
      <textarea className={inputBase} rows={rows} {...props} />
    </div>
  )
}

export function Select({ label, required, className = '', children, ...props }) {
  return (
    <div className={className}>
      {label ? <Label required={required}>{label}</Label> : null}
      <select className={`${inputBase} appearance-none bg-no-repeat`} {...props}>
        {children}
      </select>
    </div>
  )
}
