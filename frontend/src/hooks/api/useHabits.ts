import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import type { DailyHabit, WeeklyHabit } from '../../types';

interface HabitsResponse {
  habits: (DailyHabit | WeeklyHabit)[];
}

export function useHabits(frequency?: 'daily' | 'weekly') {
  return useQuery({
    queryKey: ['habits', frequency],
    queryFn: async () => {
      const params = frequency ? `?frequency=${frequency}` : '';
      const { data } = await apiClient.get<HabitsResponse>(`/habits${params}`);
      return data;
    },
  });
}
