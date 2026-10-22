import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5',
  {
    variants: {
      variant: {
        default: 'border-brand-100 bg-brand-50 text-brand-700',
        hadir: 'border-emerald-100 bg-emerald-50 text-emerald-700',
        terlambat: 'border-amber-100 bg-amber-50 text-amber-700',
        izin: 'border-sky-100 bg-sky-50 text-sky-700',
        sakit: 'border-violet-100 bg-violet-50 text-violet-700',
        alpha: 'border-red-100 bg-red-50 text-red-700',
        libur: 'border-slate-200 bg-slate-50 text-slate-600',
        outline: 'border-line bg-white text-ink-soft',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  HADIR: 'hadir',
  TERLAMBAT: 'terlambat',
  IZIN: 'izin',
  SAKIT: 'sakit',
  ALPHA: 'alpha',
  LIBUR: 'libur',
  APPROVED: 'hadir',
  PENDING: 'terlambat',
  REJECTED: 'alpha',
};

export function StatusBadge({ status }: { status: string }) {
  const labelMap: Record<string, string> = {
    HADIR: 'Hadir',
    TERLAMBAT: 'Terlambat',
    IZIN: 'Izin',
    SAKIT: 'Sakit',
    ALPHA: 'Alpha',
    LIBUR: 'Libur',
    APPROVED: 'Disetujui',
    PENDING: 'Menunggu',
    REJECTED: 'Ditolak',
  };

  return <Badge variant={STATUS_VARIANT[status] ?? 'outline'}>{labelMap[status] ?? status}</Badge>;
}

export { Badge, badgeVariants };
