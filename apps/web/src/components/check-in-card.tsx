'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Fingerprint,
  Loader2,
  LocateFixed,
  MapPinned,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { getCurrentPosition, type BrowserPosition } from '@/lib/geolocation';
import { haversineDistanceMeters } from '@/lib/geo';
import { cn, formatJarak } from '@/lib/utils';
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

  const [position, setPosition] = useState<BrowserPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitting, setSubmitting] = useState<PresensiKind | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<PresensiResult | null>(null);
  const [clock, setClock] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(
      () =>
        setClock(
          new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
          }).format(new Date()),
        ),
      1000,
    );
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

  async function openPanel(): Promise<void> {
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
      setResult({
        kind,
        time: formatJam(iso),
        message: response.message,
      });
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
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-gradient-to-r from-brand-50 to-white px-5 py-4">
        <div>
          <p className="label-caps">Absensi hari ini</p>
          <p className="mt-1 text-[15px] font-semibold text-ink">
            {finished
              ? 'Absensi hari ini selesai — terima kasih!'
              : needCheckOut
                ? 'Jam masuk sudah tercatat — saatnya absen pulang'
                : 'Belum absen masuk hari ini'}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5">
          <Clock3 className="size-3.5 text-brand-600" />
          <span className="text-[13px] font-semibold tabular-nums text-ink">{clock ?? '--:--:--'}</span>
          <span className="text-[10px] font-medium text-ink-soft">WIB</span>
        </div>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <TimeBlock label="Masuk" value={(hariIni.checkIn ?? '--:--')} tone="success" />
            <div className="h-8 w-px bg-line" />
            <TimeBlock label="Keluar" value={(hariIni.checkOut ?? '--:--')} tone="muted" />
          </div>

          <div className="rounded-xl border border-line bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <MapPinned className="mt-0.5 size-4 text-brand-600" />
                <div>
                  <p className="text-[12.5px] font-semibold text-ink">
                    {kantor?.name ?? 'Lokasi kantor belum diatur'}
                  </p>
                  <p className="text-[11px] text-ink-soft">
                    {kantor
                      ? `Radius absensi ${kantor.radius} meter dari titik kantor`
                      : 'Hubungi admin untuk mengatur lokasi kantor.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void locate()}
                disabled={locating}
                className="flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-[11px] font-medium text-ink-soft hover:text-ink disabled:opacity-60"
              >
                {locating ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                Perbarui
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
              <div className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
                <LocateFixed className="size-3.5 text-slate-400" />
                {position ? (
                  <span>
                    Jarak Anda <span className="font-semibold text-ink">{formatJarak(distance)}</span>
                    {position.accuracy ? ` · akurasi ±${Math.round(position.accuracy)} m` : ''}
                  </span>
                ) : (
                  <span>{locating ? 'Mendeteksi lokasi…' : 'Lokasi belum terdeteksi'}</span>
                )}
              </div>
              {distance !== null && kantor && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
                    insideRadius ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
                  )}
                >
                  {insideRadius ? 'Dalam radius' : 'Di luar radius'}
                </span>
              )}
            </div>
          </div>

          {geoError && <Alert variant="error">{geoError}</Alert>}
          {submitError && <Alert variant="error">{submitError}</Alert>}

          {result && (
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
          )}
        </div>

        <div className="flex flex-col justify-center gap-2.5 rounded-xl border border-dashed border-line bg-surface/60 p-4">
          {!finished && !panelOpen && (
            <>
              <Button
                size="lg"
                disabled={locating || submitting !== null}
                onClick={() => void openPanel()}
                className="w-full"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Fingerprint className="size-4" />
                )}
                Buat Kehadiran
              </Button>
              <p className="text-center text-[10.5px] leading-relaxed text-slate-400">
                {needCheckIn
                  ? 'Mencatat jam absen masuk setelah lokasi Anda sesuai.'
                  : 'Mencatat jam absen pulang setelah lokasi Anda sesuai.'}
              </p>
            </>
          )}

          {!finished && panelOpen && (
            <div className="space-y-3">
              <div>
                <p className="label-caps">Kesesuaian lokasi absen</p>
                <p className="mt-0.5 text-[13px] font-semibold text-ink">
                  {mode === 'in' ? 'Absen masuk' : 'Absen pulang'}
                </p>
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
                disabled={!insideRadius || submitting !== null || locating}
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
            </div>
          )}

          {finished && (
            <div className="flex flex-col items-center gap-1 py-2 text-center">
              <CheckCircle2 className="size-7 text-emerald-600" />
              <p className="text-[13px] font-semibold text-ink">Absensi hari ini lengkap</p>
              <p className="text-[11.5px] text-ink-soft">
                Masuk {(hariIni.checkIn ?? '--:--')} · Keluar {(hariIni.checkOut ?? '--:--')}
              </p>
            </div>
          )}

          {!insideRadius && position && !panelOpen && !finished && (
            <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-amber-700">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              Anda berada di luar radius kantor. Mendekatlah ke lokasi kantor untuk melakukan
              absensi.
            </p>
          )}

          <p className="text-center text-[10.5px] leading-relaxed text-slate-400">
            Lokasi &amp; waktu perangkat diverifikasi oleh server saat presensi dikirim.
          </p>
        </div>
      </div>
    </div>
  );
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

function TimeBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'muted';
}) {
  return (
    <div>
      <p className="label-caps">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        {tone === 'success' ? (
          <span className="size-1.5 rounded-full bg-emerald-500" />
        ) : (
          <span className="size-1.5 rounded-full bg-slate-300" />
        )}
        <p className="text-lg font-bold tabular-nums tracking-tight text-ink">{value}</p>
      </div>
    </div>
  );
}
