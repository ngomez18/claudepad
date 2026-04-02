export default function ViewModeToggle<T extends string>({
  modes,
  value,
  onChange,
}: {
  modes: { id: T; label: string; icon: React.ElementType }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex items-center gap-0.5 bg-white/4 rounded-md p-0.5">
      {modes.map(m => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] transition-colors cursor-pointer ${
            value === m.id ? 'bg-white/10 text-slate-200' : 'text-slate-600 hover:text-slate-400'
          }`}
        >
          <m.icon className="size-3" />
          {m.label}
        </button>
      ))}
    </div>
  )
}
