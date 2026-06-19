import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import type { CompleteHabitResponse } from '../../types';

interface CompleteHabitVars {
  habitId: string;
  syncId: string;
  completedAt?: string;
}

export function useCompleteHabit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId, syncId, completedAt }: CompleteHabitVars) => {
      const { data } = await apiClient.post<CompleteHabitResponse>(
        `/habits/${habitId}/complete`,
        { syncId, ...(completedAt ? { completedAt } : {}) },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['habits'] });
      qc.invalidateQueries({ queryKey: ['character'] });
      qc.invalidateQueries({ queryKey: ['achievements'] });
      qc.invalidateQueries({ queryKey: ['xp-events'] });
    },
  });
}
