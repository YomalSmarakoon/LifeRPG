import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import type { ApiAchievement } from '../../types';

export function useAchievements() {
  return useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiAchievement[]>('/achievements');
      return data;
    },
  });
}
