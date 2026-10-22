import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label="Logo BPS Padang Lawas"
      className={cn('size-10', className)}
    >
      <rect width="40" height="40" rx="11" fill="#005BAA" />
      <rect x="9" y="21" width="4.5" height="10" rx="1.4" fill="#FFFFFF" opacity="0.55" />
      <rect x="17.75" y="15" width="4.5" height="16" rx="1.4" fill="#FFFFFF" opacity="0.78" />
      <rect x="26.5" y="9" width="4.5" height="22" rx="1.4" fill="#FFFFFF" />
      <path d="M9 13.5L17 10.5L23 12.5L31 8" stroke="#7FC4FF" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      {!compact && (
        <div className="leading-tight">
          <p className="text-[13px] font-bold tracking-tight text-ink">BPS Padang Lawas</p>
          <p className="text-[11px] text-ink-soft">Sistem Absensi Magang</p>
        </div>
      )}
    </div>
  );
}
