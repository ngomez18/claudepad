import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GetCommands, EventsOn } from '@/lib/api'

export function useCommands(projectPath: string) {
  const queryClient = useQueryClient()
  useEffect(() => {
    return EventsOn('commands:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['commands'] })
    })
  }, [queryClient])
  return useQuery({ queryKey: ['commands', projectPath], queryFn: () => GetCommands(projectPath) })
}
