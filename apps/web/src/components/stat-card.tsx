import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: LucideIcon;
  hint?: string;
  tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger';
}) {
  const tones = {
    default: 'bg-surface text-ink-soft',
    brand: 'bg-brand-50 text-brand-600',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-600',
  } as const;

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <p className="label-caps">{label}</p>
        <span className={cn('flex size-8 items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-ink tnum">
        {value}
        {suffix && <span className="ml-1 text-sm font-semibold text-ink-soft">{suffix}</span>}
      </p>
      {hint && <p className="mt-1 text-[11.5px] text-ink-soft">{hint}</p>}
    </div>
  );
}
