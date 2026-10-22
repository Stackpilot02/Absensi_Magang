'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck2,
  CircleSlash,
  Clock4,
  FileSpreadsheet,
  Percent,
  UserCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { PageHeader, Skeleton, TableSkeleton } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { CheckInCard } from '@/components/check-in-card';
import { WeeklyChart, WeeklyLegend } from '@/components/weekly-chart';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/page-header';
import { formatTanggal, NAMA_BULAN } from '@/lib/utils';
import type { DashboardSummary } from '@/lib/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.get<DashboardSummary>('/dashboard/summary');
      setSummary(data);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Gagal memuat dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const firstName = user?.name.split(' ')[0] ?? '';
  const jam = new Date().getHours();
  const greeting = jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam';

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description={
          user?.role === 'MAGANG'
            ? 'Berikut ringkasan kehadiran Anda hari ini dan bulan berjalan.'
            : 'Pantau kehadiran pegawai magang BPS Kabupaten Padang Lawas secara ringkas.'
        }
        actions={
          user?.role === 'MAGANG' ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/riwayat">
                <CalendarCheck2 className="size-4" />
                Riwayat lengkap
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href="/laporan">
                <FileSpreadsheet className="size-4" />
                Buka laporan
              </Link>
            </Button>
          )
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {loading && (
        <div className="space-y-5">
          <Skeleton className="h-52 w-full" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {!loading && summary && (
        <>
          {summary.scope === 'pegawai' ? (
            <>
              <CheckInCard summary={summary} onChanged={() => void load()} />

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  label="Hadir bulan ini"
                  value={summary.statistik.hadir ?? 0}
                  suffix="hari"
                  icon={UserCheck}
                  tone="success"
                  hint={`dari ${summary.statistik.hariKerja ?? 0} hari kerja`}
                />
                <StatCard
                  label="Terlambat"
                  value={summary.statistik.terlambat ?? 0}
                  suffix="hari"
                  icon={Clock4}
                  tone="warning"
                />
                <StatCard
                  label="Izin / Sakit"
                  value={(summary.statistik.izin ?? 0) + (summary.statistik.sakit ?? 0)}
                  suffix="hari"
                  icon={CalendarCheck2}
                  tone="brand"
                />
                <StatCard
                  label="Kehadiran"
                  value={summary.statistik.persentaseKehadiran ?? 0}
                  suffix="%"
                  icon={Percent}
                  tone="brand"
                  hint={`${NAMA_BULAN[(summary.statistik.bulan ?? 1) - 1]} ${summary.statistik.tahun ?? ''}`}
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Total peserta"
                value={summary.statistik.totalPeserta ?? 0}
                suffix="orang"
                icon={Users}
                tone="brand"
              />
              <StatCard
                label="Hadir hari ini"
                value={summary.statistik.hadir ?? 0}
                suffix="orang"
                icon={UserCheck}
                tone="success"
              />
              <StatCard
                label="Terlambat"
                value={summary.statistik.terlambat ?? 0}
                suffix="orang"
                icon={Clock4}
                tone="warning"
              />
              <StatCard
                label="Belum absen"
                value={summary.statistik.belumAbsen ?? 0}
                suffix="orang"
                icon={CircleSlash}
                tone="danger"
                hint={`Kehadiran ${summary.statistik.persentaseKehadiran ?? 0}%`}
              />
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>Tren 7 hari terakhir</CardTitle>
                  <p className="mt-0.5 text-[12px] text-ink-soft">
                    Jumlah absensi tercatat per hari
                  </p>
                </div>
                <WeeklyLegend />
              </CardHeader>
              <CardContent>
                <WeeklyChart data={summary.trenMingguan} />
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Lokasi absensi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {summary.kantor ? (
                  <>
                    <div className="rounded-xl bg-surface p-3">
                      <p className="text-[12.5px] font-semibold text-ink">{summary.kantor.name}</p>
                      <p className="mt-1 text-[11.5px] text-ink-soft">
                        {summary.kantor.latitude.toFixed(5)}, {summary.kantor.longitude.toFixed(5)}
                      </p>
                      <p className="mt-2 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-semibold text-brand-700">
                        Radius {summary.kantor.radius} meter
                      </p>
                    </div>
                    <p className="text-[11.5px] leading-relaxed text-ink-soft">
                      Pastikan GPS perangkat aktif dan Anda berada di area kantor sebelum melakukan
                      absensi.
                    </p>
                  </>
                ) : (
                  <Alert variant="info">
                    Lokasi kantor belum dikonfigurasi. Hubungi administrator untuk mengatur titik
                    dan radius absensi.
                  </Alert>
                )}

                {summary.scope === 'pengelola' && (
                  <div className="mt-auto grid gap-2 pt-1">
                    <Button asChild variant="outline" size="sm" className="justify-between">
                      <Link href="/mahasiswa">
                        Kelola data peserta
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="justify-between">
                      <Link href="/izin">
                        Persetujuan izin &amp; sakit
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Aktivitas absensi terakhir</CardTitle>
              <Link
                href="/riwayat"
                className="text-[12px] font-semibold text-brand-600 hover:underline"
              >
                Lihat semua
              </Link>
            </CardHeader>
            <CardContent className="p-0 pb-1">
              {summary.aktivitasTerakhir.length === 0 ? (
                <EmptyState
                  title="Belum ada aktivitas absensi"
                  description="Data absensi akan muncul setelah pegawai melakukan check-in."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {summary.scope === 'pengelola' && <TableHead>Nama</TableHead>}
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Masuk</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.aktivitasTerakhir.map((item) => (
                      <TableRow key={item.id}>
                        {summary.scope === 'pengelola' && (
                          <TableCell className="font-medium">{item.nama}</TableCell>
                        )}
                        <TableCell className="text-ink-soft">{formatTanggal(item.tanggal)}</TableCell>
                        <TableCell className="tnum">{item.checkIn ?? '--:--'}</TableCell>
                        <TableCell className="text-right">
                          <StatusBadge status={item.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {loading && <TableSkeleton />}
    </div>
  );
}
