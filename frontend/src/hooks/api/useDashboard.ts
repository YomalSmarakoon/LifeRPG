import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import type { ApiDashboardResponse } from '../../types';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiDashboardResponse>('/dashboard');
      return data;
    },
  });
}
