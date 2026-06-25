import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import type { HeatmapDay } from '../../types';

function getLast30DayRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { from: fmt(from), to: fmt(to) };
}

function buildHeatmapDays(
  raw: { dateKey: string; completedCount: number }[],
  from: string,
  to: string,
): HeatmapDay[] {
  const map = new Map(raw.map((r) => [r.dateKey, r.completedCount]));
  const days: HeatmapDay[] = [];
  const todayStr = new Date().toISOString().split('T')[0];
  const cursor = new Date(from);
  const end = new Date(to);

  while (cursor <= end) {
    const dateKey = cursor.toISOString().split('T')[0];
    const completedCount = map.get(dateKey) ?? 0;
    days.push({
      dateKey,
      completedCount,
      // Heatmap has no per-day totalCount from the API — use >0 as partial indicator
      totalCount: completedCount > 0 ? completedCount : 1,
      isToday: dateKey === todayStr,
      isFuture: dateKey > todayStr,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export function useHeatmap() {
  const { from, to } = getLast30DayRange();

  return useQuery({
    queryKey: ['heatmap', from, to],
    queryFn: async () => {
      const { data } = await apiClient.get<{ dateKey: string; completedCount: number }[]>(
        `/habits/history/heatmap?from=${from}&to=${to}`,
      );
      return buildHeatmapDays(data, from, to);
    },
    staleTime: 60_000,
  });
}
