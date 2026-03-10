import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GetSettings, EventsOn } from '@/lib/api'

export function useSettings(projectPath: string) {
  const queryClient = useQueryClient()
  useEffect(() => {
    return EventsOn('settings:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    })
  }, [queryClient])
  return useQuery({
    queryKey: ['settings', projectPath],
    queryFn: () => GetSettings(projectPath),
  })
}
