import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GetClaudeMd, EventsOn } from '@/lib/api'

export function useClaudeMd(projectPath: string) {
  const queryClient = useQueryClient()
  useEffect(() => {
    return EventsOn('claudemd:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['claudemd'] })
    })
  }, [queryClient])
  return useQuery({
    queryKey: ['claudemd', projectPath],
    queryFn: () => GetClaudeMd(projectPath),
  })
}
