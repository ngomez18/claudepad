import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GetPreservedPlans, EventsOn } from '@/lib/api'

export function usePreservedPlans() {
  const queryClient = useQueryClient()
  useEffect(() => {
    return EventsOn('plans:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['preserved-plans'] })
    })
  }, [queryClient])
  return useQuery({ queryKey: ['preserved-plans'], queryFn: GetPreservedPlans })
}
