import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GetSessions, EventsOn } from '@/lib/api'

export function useSessions() {
  const queryClient = useQueryClient()
  useEffect(() => {
    return EventsOn('sessions:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    })
  }, [queryClient])
  return useQuery({ queryKey: ['sessions'], queryFn: GetSessions })
}
