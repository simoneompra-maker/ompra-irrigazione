export default function EmptyState({ icon = '🌱', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="text-5xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold text-gray-800">{title}</h3>
      {description ? <p className="text-gray-500 mt-1 max-w-xs">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
