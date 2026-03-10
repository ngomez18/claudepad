import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GetProjects, EventsOn } from '@/lib/api'

export function useProjects() {
  const queryClient = useQueryClient()
  useEffect(() => {
    return EventsOn('projects:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    })
  }, [queryClient])
  return useQuery({ queryKey: ['projects'], queryFn: GetProjects })
}
