'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarRange,
  CheckCircle2,
  Clock3,
  Fingerprint,
  Loader2,
  LocateFixed,
  LogOut,
  NotebookPen,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { ROLE_LABEL } from '@/components/app-shell';
import { getCurrentPosition, type BrowserPosition } from '@/lib/geolocation';
import { haversineDistanceMeters } from '@/lib/geo';
import { cn, formatJarak, formatTanggalPanjang, initials } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { DashboardSummary } from '@/lib/types';

interface CheckInCardProps {
  summary: DashboardSummary;
  onChanged: () => void;
}

type PresensiKind = 'in' | 'out';

interface PresensiResult {
  kind: PresensiKind;
  time: string;
  message: string;
}

export function CheckInCard({ summary, onChanged }: CheckInCardProps) {
  const { kantor, hariIni } = summary;
  const jadwal = summary.jadwal ?? { masuk: '07:30', pulang: '16:00' };
  const { user, logout } = useAuth();

  const [position, setPosition] = useState<BrowserPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitting, setSubmitting] = useState<PresensiKind | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<PresensiResult | null>(null);
  const [clock, setClock] = useState<string | null>(null);
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);

  useEffect(() => {
    function tick(): void {
      const current = new Date();
      setClock(
        new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
        }).format(current),
      );
      const [hour, minute] = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .format(current)
        .split(':')
        .map(Number);
      setNowMinutes(hour * 60 + minute);
    }

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const locate = useCallback(async () => {
    setLocating(true);
    setGeoError(null);
    try {
      const current = await getCurrentPosition();
      setPosition(current);
    } catch (error) {
      setGeoError(error instanceof Error ? error.message : 'Gagal mendapatkan lokasi.');
      setPosition(null);
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    void locate();
  }, [locate]);

  const distance =
    position && kantor
      ? haversineDistanceMeters(position, { latitude: kantor.latitude, longitude: kantor.longitude })
      : null;

  const insideRadius = distance !== null && kantor ? distance <= kantor.radius : false;
  const needCheckIn = !hariIni.checkIn;
  const needCheckOut = Boolean(hariIni.checkIn) && !hariIni.checkOut;
  const finished = Boolean(hariIni.checkIn && hariIni.checkOut);
  const mode: PresensiKind = needCheckIn ? 'in' : 'out';
  const checkoutOpen = nowMinutes !== null && nowMinutes >= parseTimeMinutes(jadwal.pulang);
  const waitingForCheckout = needCheckOut && nowMinutes !== null && !checkoutOpen;

  const statusText = finished
    ? 'Absensi hari ini lengkap. Terima kasih!'
    : waitingForCheckout
      ? `Absen pulang baru dibuka pukul ${formatJadwal(jadwal.pulang)} WIB.`
      : needCheckOut
        ? 'Jam masuk sudah tercatat — jangan lupa absen pulang.'
        : 'Belum absen masuk hari ini.';

  async function openPanel(): Promise<void> {
    if (waitingForCheckout) {
      setSubmitError(`Absen pulang baru dapat dilakukan mulai pukul ${formatJadwal(jadwal.pulang)} WIB.`);
      return;
    }
    setSubmitError(null);
    setPanelOpen(true);
    await locate();
  }

  async function submitPresensi(): Promise<void> {
    if (!position) {
      setGeoError('Lokasi belum terdeteksi. Tekan "Perbarui lokasi" lalu coba lagi.');
      return;
    }

    const kind: PresensiKind = needCheckIn ? 'in' : 'out';
    setSubmitting(kind);
    setSubmitError(null);

    try {
      const response = await api.post<{
        message: string;
        data: { checkIn: string | null; checkOut: string | null };
      }>(kind === 'in' ? '/attendance/check-in' : '/attendance/check-out', {
        latitude: position.latitude,
        longitude: position.longitude,
        deviceTime: position.deviceTime,
      });

      const iso = kind === 'in' ? response.data.checkIn : response.data.checkOut;
      setResult({ kind, time: formatJam(iso), message: response.message });
      setPanelOpen(false);
      onChanged();
    } catch (error) {
      setSubmitError(
        error instanceof ApiError ? error.message : 'Presensi gagal diproses. Coba lagi.',
      );
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_18px_40px_-28px_rgba(2,32,71,0.55)]">
      {/* Header biru dengan motif */}
      <div className="relative isolate overflow-hidden bg-gradient-to-br from-[#00498c] via-[#005baa] to-[#0a7dc4] px-5 pb-14 pt-5 text-white sm:px-6">
        <HeroPattern />

        <div className="relative mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-[13px] font-bold ring-2 ring-white/70 backdrop-blur">
              {initials(user?.name ?? 'Pengguna')}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold leading-tight">
                {user?.name ?? 'Pengguna'}
              </p>
              <p className="mt-0.5 text-[10.5px] text-white/75">
                {user ? ROLE_LABEL[user.role] : 'Pegawai Magang'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Keluar dari akun"
            title="Keluar"
            className="rounded-full bg-white/10 p-2 text-white/90 transition-colors hover:bg-white/20"
          >
            <LogOut className="size-4" />
          </button>
        </div>

        <div className="relative mx-auto mt-6 flex max-w-2xl justify-center">
          <div className="relative inline-flex items-center rounded-full bg-gradient-to-r from-orange-400 to-orange-500 px-4 py-1.5 text-[11px] font-semibold shadow-[0_6px_16px_-8px_rgba(234,88,12,0.9)]">
            {formatTanggalPanjang(new Date())}
            <span className="absolute -right-2.5 -top-2 rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide shadow-sm">
              WFO
            </span>
          </div>
        </div>
      </div>

      {/* Kartu jam datang & pulang */}
      <div className="relative z-10 mx-auto -mt-9 max-w-2xl px-5 sm:px-6">
        <div className="grid grid-cols-2 divide-x divide-line rounded-xl border border-line bg-white px-2 py-4 shadow-[0_12px_28px_-20px_rgba(2,32,71,0.5)]">
          <div className="px-3 text-center">
            <p className="text-[11px] font-medium text-ink-soft">Jam Datang</p>
            <p className="mt-1 text-[30px] font-bold leading-none tabular-nums tracking-tight text-brand-700">
              {hariIni.checkIn ?? '--:--'}
            </p>
          </div>
          <div className="px-3 text-center">
            <p className="text-[11px] font-medium text-ink-soft">Jam Pulang</p>
            <p className="mt-1 text-[30px] font-bold leading-none tabular-nums tracking-tight text-brand-700">
              {hariIni.checkOut ?? '--:--'}
            </p>
          </div>
        </div>
      </div>

      {/* Tiga aksi utama */}
      <div className="mx-auto max-w-2xl px-5 pt-5 sm:px-6">
        <div className="grid grid-cols-3 gap-2.5">
          <ActionTile
            href="/riwayat"
            icon={CalendarRange}
            label="Presensi Bulanan"
            description="Lihat rekap kehadiran bulan ini"
          />

          <button
            type="button"
            onClick={() => void openPanel()}
            disabled={finished || waitingForCheckout || locating || submitting !== null}
            title={
              waitingForCheckout
                ? `Absen pulang dibuka pukul ${formatJadwal(jadwal.pulang)} WIB`
                : undefined
            }
            className={cn(
              'group flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-all',
              finished
                ? 'cursor-default border-emerald-200 bg-emerald-50 text-emerald-700'
                : waitingForCheckout
                  ? 'cursor-not-allowed border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-brand-100 bg-gradient-to-b from-brand-50 to-brand-100/80 text-brand-800 hover:border-brand-300 hover:from-brand-100 hover:to-brand-100 active:scale-[0.98]',
              panelOpen && !finished && 'ring-2 ring-brand-300',
            )}
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-white/80 shadow-sm">
              {submitting ? (
                <Loader2 className="size-[18px] animate-spin" />
              ) : finished ? (
                <CheckCircle2 className="size-[18px] text-emerald-600" />
              ) : waitingForCheckout ? (
                <Clock3 className="size-[18px] text-amber-600" />
              ) : (
                <Fingerprint className="size-[18px] text-brand-600" />
              )}
            </span>
            <span className="text-[11px] font-semibold leading-tight">
              {finished ? 'Presensi Selesai' : waitingForCheckout ? 'Belum Waktunya' : 'Buat Kehadiran'}
            </span>
          </button>

          <ActionTile
            href="/kegiatan"
            icon={NotebookPen}
            label="Lapor Kegiatan"
            description="Catat aktivitas harian magang"
          />
        </div>

        <p className="mt-3 text-center text-[11px] text-ink-soft">{statusText}</p>

        <p className="mt-1 flex items-center justify-center gap-1.5 text-[10.5px] text-ink-soft">
          <Clock3 className="size-3.5 text-slate-400" />
          Jam kerja {formatJadwal(jadwal.masuk)}–{formatJadwal(jadwal.pulang)} WIB
        </p>

        <div className="mt-2 flex items-center justify-center gap-1.5 text-[10.5px] text-ink-soft">
          <LocateFixed className="size-3.5 text-slate-400" />
          {position ? (
            <span>
              Jarak ke kantor <span className="font-semibold text-ink">{formatJarak(distance)}</span>
              {kantor ? ` · radius ${kantor.radius} m` : ''}
            </span>
          ) : (
            <span>{locating ? 'Mendeteksi lokasi…' : 'Lokasi belum terdeteksi'}</span>
          )}
          <button
            type="button"
            onClick={() => void locate()}
            disabled={locating}
            className="ml-1 inline-flex items-center gap-1 font-medium text-brand-700 hover:underline disabled:opacity-60"
          >
            {locating ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            Perbarui
          </button>
        </div>
      </div>

      {/* Hasil presensi */}
      {result && (
        <div className="mx-auto max-w-2xl px-5 pt-4 sm:px-6">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
              Jam {result.kind === 'in' ? 'masuk' : 'pulang'} tercatat
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-emerald-800">
              {result.time}
              <span className="ml-1 text-[11px] font-semibold text-emerald-700">WIB</span>
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-emerald-700">{result.message}</p>
          </div>
        </div>
      )}

      {/* Panel kesesuaian lokasi */}
      {panelOpen && !finished && (
        <div className="mx-auto max-w-2xl px-5 pt-4 sm:px-6">
          <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/50 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="label-caps">Kesesuaian lokasi absen</p>
                <p className="mt-0.5 text-[13px] font-semibold text-ink">
                  {mode === 'in' ? 'Absen masuk' : 'Absen pulang'}
                </p>
              </div>
              <span className="rounded-full border border-line bg-white px-2 py-1 text-[10.5px] font-semibold tabular-nums text-ink-soft">
                {clock ?? '--:--:--'} WIB
              </span>
            </div>

            <div
              className={cn(
                'rounded-lg border p-3',
                locating
                  ? 'border-line bg-white'
                  : insideRadius
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-amber-200 bg-amber-50',
              )}
            >
              <div className="flex items-center gap-2">
                {locating ? (
                  <Loader2 className="size-4 animate-spin text-brand-600" />
                ) : insideRadius ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <TriangleAlert className="size-4 text-amber-600" />
                )}
                <p
                  className={cn(
                    'text-[12.5px] font-semibold',
                    locating
                      ? 'text-ink'
                      : insideRadius
                        ? 'text-emerald-800'
                        : 'text-amber-800',
                  )}
                >
                  {locating
                    ? 'Memeriksa lokasi…'
                    : insideRadius
                      ? 'Lokasi sesuai'
                      : position
                        ? 'Lokasi belum sesuai'
                        : 'Lokasi belum terdeteksi'}
                </p>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
                {position && kantor
                  ? `Jarak ${formatJarak(distance)} dari ${kantor.name} · radius absensi ${kantor.radius} m.`
                  : 'Aktifkan GPS perangkat, lalu tekan Perbarui lokasi.'}
              </p>
              {position?.accuracy ? (
                <p className="mt-0.5 text-[10.5px] text-ink-soft">
                  Akurasi perangkat ±{Math.round(position.accuracy)} m
                </p>
              ) : null}
            </div>

            <Button
              size="lg"
              disabled={!insideRadius || submitting !== null || locating || waitingForCheckout}
              onClick={() => void submitPresensi()}
              className="w-full"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Fingerprint className="size-4" />
              )}
              Presensi
            </Button>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void locate()}
                disabled={locating}
                className="text-[11px] font-medium text-brand-700 hover:underline disabled:opacity-60"
              >
                Perbarui lokasi
              </button>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="text-[11px] font-medium text-ink-soft hover:text-ink"
              >
                Batal
              </button>
            </div>

            <p className="text-center text-[10px] leading-relaxed text-slate-400">
              Lokasi &amp; waktu perangkat diverifikasi oleh server saat presensi dikirim.
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-2xl space-y-2 px-5 pb-5 pt-3 sm:px-6">
        {geoError && <Alert variant="error">{geoError}</Alert>}
        {submitError && <Alert variant="error">{submitError}</Alert>}

        {!insideRadius && position && !panelOpen && !finished && (
          <p className="flex items-start justify-center gap-1.5 text-center text-[11px] leading-relaxed text-amber-700">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            Anda berada di luar radius kantor. Mendekatlah ke lokasi kantor untuk melakukan absensi.
          </p>
        )}
      </div>
    </div>
  );
}

function ActionTile({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      title={description}
      className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-brand-100 bg-gradient-to-b from-brand-50 to-brand-100/80 p-3 text-center text-brand-800 transition-all hover:border-brand-300 hover:from-brand-100 hover:to-brand-100 active:scale-[0.98]"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-white/80 shadow-sm">
        <Icon className="size-[18px] text-brand-600" />
      </span>
      <span className="text-[11px] font-semibold leading-tight">{label}</span>
    </Link>
  );
}

/** Motif dekoratif bergaya batik pada header biru. */
function HeroPattern() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full opacity-[0.16]"
      viewBox="0 0 400 220"
      preserveAspectRatio="none"
    >
      <g fill="none" stroke="white" strokeWidth="1.2">
        <path d="M-30 44c46-38 92-38 138 0s92 38 138 0 92-38 138 0 92 38 138 0" />
        <path d="M-30 64c46-38 92-38 138 0s92 38 138 0 92-38 138 0 92 38 138 0" />
        <path d="M-30 150c46-38 92-38 138 0s92 38 138 0 92-38 138 0 92 38 138 0" />
        <path d="M-30 170c46-38 92-38 138 0s92 38 138 0 92-38 138 0 92 38 138 0" />
        <circle cx="54" cy="112" r="30" />
        <circle cx="54" cy="112" r="18" />
        <circle cx="54" cy="112" r="7" />
        <circle cx="352" cy="112" r="30" />
        <circle cx="352" cy="112" r="18" />
        <circle cx="352" cy="112" r="7" />
        <circle cx="204" cy="112" r="34" />
        <circle cx="204" cy="112" r="20" />
      </g>
      <g fill="white" opacity="0.5">
        <circle cx="116" cy="196" r="2" />
        <circle cx="144" cy="196" r="2" />
        <circle cx="172" cy="196" r="2" />
        <circle cx="228" cy="196" r="2" />
        <circle cx="256" cy="196" r="2" />
        <circle cx="284" cy="196" r="2" />
      </g>
    </svg>
  );
}

function parseTimeMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

/** Menampilkan jam gaya Indonesia, mis. 16:00 menjadi 16.00. */
function formatJadwal(value: string): string {
  return value.replace(':', '.');
}

function formatJam(value: string | null): string {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}
