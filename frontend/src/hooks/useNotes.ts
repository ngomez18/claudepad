import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GetNotes, EventsOn } from '@/lib/api'

export function useNotes() {
  const queryClient = useQueryClient()
  useEffect(() => {
    return EventsOn('notes:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    })
  }, [queryClient])
  return useQuery({ queryKey: ['notes'], queryFn: GetNotes })
}
