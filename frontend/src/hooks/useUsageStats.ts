import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GetUsageStats, EventsOn } from '@/lib/api'

export function useUsageStats() {
  const queryClient = useQueryClient()
  useEffect(() => {
    return EventsOn('usage:stats-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['usage'] })
    })
  }, [queryClient])
  return useQuery({ queryKey: ['usage'], queryFn: GetUsageStats })
}
