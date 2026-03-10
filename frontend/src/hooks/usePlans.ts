import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GetPlans, EventsOn } from '@/lib/api'

export function usePlans() {
  const queryClient = useQueryClient()
  useEffect(() => {
    return EventsOn('plans:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
    })
  }, [queryClient])
  return useQuery({ queryKey: ['plans'], queryFn: GetPlans })
}
