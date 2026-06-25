import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import type { UndoHabitResponse } from '../../types';

interface UndoHabitVars {
  habitId: string;
  dateKey: string;
}

export function useUndoHabit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId, dateKey }: UndoHabitVars) => {
      const { data } = await apiClient.post<UndoHabitResponse>(
        `/habits/${habitId}/undo`,
        { dateKey },
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
