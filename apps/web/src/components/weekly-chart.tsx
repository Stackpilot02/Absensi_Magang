'use client';

import { cn } from '@/lib/utils';
import type { DashboardSummary } from '@/lib/types';

/** Grafik batang sederhana tanpa dependency chart tambahan. */
export function WeeklyChart({ data }: { data: DashboardSummary['trenMingguan'] }) {
  const max = Math.max(...data.map((item) => item.hadir + item.terlambat), 1);

  return (
    <div className="flex h-40 items-end gap-2 sm:gap-3">
      {data.map((item) => {
        const total = item.hadir + item.terlambat;
        const hadirHeight = (item.hadir / max) * 100;
        const terlambatHeight = (item.terlambat / max) * 100;

        return (
          <div key={item.tanggal} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[10px] font-semibold tabular-nums text-ink-soft">
              {total || ''}
            </span>
            <div className="flex h-28 w-full max-w-9 flex-col justify-end gap-0.5">
              <div
                className={cn('w-full rounded-t-[3px] bg-amber-400/80 transition-all')}
                style={{ height: `${terlambatHeight}%` }}
                title={`Terlambat: ${item.terlambat}`}
              />
              <div
                className="w-full rounded-b-[3px] bg-brand-600 transition-all"
                style={{ height: `${hadirHeight}%` }}
                title={`Hadir: ${item.hadir}`}
              />
            </div>
            <span className="text-[10.5px] capitalize text-slate-400">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function WeeklyLegend() {
  return (
    <div className="flex items-center gap-4 text-[11px] text-ink-soft">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-sm bg-brand-600" /> Hadir
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-sm bg-amber-400/80" /> Terlambat
      </span>
    </div>
  );
}
