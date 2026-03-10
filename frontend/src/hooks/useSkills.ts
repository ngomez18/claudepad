import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GetSkills, EventsOn } from '@/lib/api'

export function useSkills(projectPath: string) {
  const queryClient = useQueryClient()
  useEffect(() => {
    return EventsOn('skills:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    })
  }, [queryClient])
  return useQuery({ queryKey: ['skills', projectPath], queryFn: () => GetSkills(projectPath) })
}
