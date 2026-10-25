'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  NotebookPen,
  Settings,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { BrandLockup } from '@/components/brand';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatTanggalPanjang, initials } from '@/lib/utils';
import type { Role } from '@/lib/types';

const ALL_ROLES: Role[] = ['ADMIN', 'PEMBIMBING', 'MAGANG', 'KEPALA_BPS'];

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
  mobile?: boolean;
}> = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL_ROLES, mobile: true },
  { href: '/riwayat', label: 'Riwayat Absensi', icon: History, roles: ALL_ROLES, mobile: true },
  {
    href: '/mahasiswa',
    label: 'Data Mahasiswa',
    icon: Users,
    roles: ['ADMIN', 'PEMBIMBING', 'KEPALA_BPS'],
  },
  { href: '/kegiatan', label: 'Lapor Kegiatan', icon: NotebookPen, roles: ALL_ROLES, mobile: false },
  { href: '/laporan', label: 'Laporan', icon: FileSpreadsheet, roles: ALL_ROLES, mobile: true },
  { href: '/pengaturan', label: 'Pengaturan', icon: Settings, roles: ['ADMIN'] },
  { href: '/profil', label: 'Profil', icon: UserRound, roles: ALL_ROLES, mobile: true },
];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  PEMBIMBING: 'Pembimbing',
  MAGANG: 'Pegawai Magang',
  KEPALA_BPS: 'Kepala BPS',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <BrandLockup />
          <p className="text-[13px] text-ink-soft">Memuat sesi…</p>
        </div>
      </div>
    );
  }

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const mobileItems = items.filter((item) => item.mobile);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh bg-surface">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-line px-5">
          <Link href="/dashboard" aria-label="Ke halaman dashboard">
            <BrandLockup />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="label-caps px-3 pb-2">Menu utama</p>
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-ink-soft hover:bg-surface hover:text-ink',
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-brand-600" />
                    )}
                    <item.icon
                      className={cn('size-[17px]', active ? 'text-brand-600' : 'text-slate-400')}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-line p-3">
          <div className="rounded-xl bg-surface p-3">
            <p className="label-caps">Zona waktu</p>
            <p className="mt-1 text-[12px] font-medium text-ink">WIB · Asia/Jakarta</p>
            <p className="mt-0.5 text-[11px] text-ink-soft">
              {now ? formatTanggalPanjang(now) : '—'}
            </p>
          </div>
        </div>
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-[#0b1c2c]/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <BrandLockup />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-surface"
                aria-label="Tutup menu"
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium',
                        isActive(item.href)
                          ? 'bg-brand-50 text-brand-800'
                          : 'text-ink-soft hover:bg-surface',
                      )}
                    >
                      <item.icon className="size-[17px]" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-surface lg:hidden"
              aria-label="Buka menu"
            >
              <Menu className="size-5" />
            </button>
            <div className="hidden lg:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                {ROLE_LABEL[user.role]}
              </p>
              <p className="text-[13px] font-semibold text-ink">
                {now ? formatTanggalPanjang(now) : '—'}
              </p>
            </div>
            <div className="lg:hidden">
              <BrandLockup compact />
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-2.5 transition-colors hover:bg-surface"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                  {initials(user.name)}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-40 truncate text-[12.5px] font-semibold leading-tight text-ink">
                    {user.name}
                  </span>
                  <span className="block text-[10.5px] leading-tight text-ink-soft">
                    {ROLE_LABEL[user.role]}
                  </span>
                </span>
                <ChevronDown className="size-3.5 text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Akun saya</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/profil">
                  <UserRound className="size-4 text-slate-400" />
                  Profil &amp; keamanan
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:bg-red-50 focus:text-red-700"
                onSelect={() => {
                  void logout();
                }}
              >
                <LogOut className="size-4" />
                Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 lg:pb-10">{children}</main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:hidden">
        <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
          {mobileItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium transition-colors',
                    active ? 'text-brand-700' : 'text-slate-500',
                  )}
                >
                  <item.icon className={cn('size-[19px]', active && 'text-brand-600')} />
                  <span className="truncate">{item.label.split(' ')[0]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
