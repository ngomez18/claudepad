import { useQuery } from '@tanstack/react-query'
import { GetSessionTranscript } from '@/lib/api'

export function useTranscript(projectPath: string, sessionId: string | null) {
  return useQuery({
    queryKey: ['transcript', projectPath, sessionId],
    queryFn: () => GetSessionTranscript(projectPath, sessionId!),
    enabled: !!sessionId,
  })
}
