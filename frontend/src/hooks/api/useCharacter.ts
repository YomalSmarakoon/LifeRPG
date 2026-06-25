import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import type { Character } from '../../types';

export function useCharacter() {
  return useQuery({
    queryKey: ['character'],
    queryFn: async () => {
      const { data } = await apiClient.get<Character>('/character');
      return data;
    },
  });
}
