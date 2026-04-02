import type { ElementType } from 'react'

export default function EmptyState({
  icon: Icon,
  loading,
  title,
  description,
}: {
  icon: ElementType
  loading: boolean
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
      <Icon className="size-6 text-slate-700" />
      <p className="text-[14px] text-slate-600">{loading ? 'Loading…' : title}</p>
      {!loading && description && (
        <p className="text-[12px] text-slate-700">{description}</p>
      )}
    </div>
  )
}
