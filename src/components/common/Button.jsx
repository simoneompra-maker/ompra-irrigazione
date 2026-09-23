const VARIANTI = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 disabled:bg-gray-300',
  secondary: 'bg-white text-brand-800 border border-brand-300 hover:bg-brand-50 disabled:text-gray-400 disabled:border-gray-200',
  ghost: 'bg-transparent text-brand-800 hover:bg-brand-50 disabled:text-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300',
  outlineDanger: 'bg-white text-red-600 border border-red-300 hover:bg-red-50 disabled:text-gray-400',
}

const TAGLIE = {
  md: 'px-4 py-2.5 text-base rounded-xl',
  sm: 'px-3 py-2 text-sm rounded-lg',
  lg: 'px-5 py-3.5 text-lg rounded-2xl',
  icon: 'p-2.5 rounded-xl',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  full = false,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`btn font-semibold transition-colors inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed select-none ${VARIANTI[variant]} ${TAGLIE[size]} ${full ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
