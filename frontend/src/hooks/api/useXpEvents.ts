import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import type { XpEvent } from '../../types';

interface XpEventsResponse {
  events: XpEvent[];
  nextCursor: string | null;
}

export function useXpEvents(limit = 20) {
  return useQuery({
    queryKey: ['xp-events', limit],
    queryFn: async () => {
      const { data } = await apiClient.get<XpEventsResponse>(`/xp/events?limit=${limit}`);
      return data;
    },
  });
}
