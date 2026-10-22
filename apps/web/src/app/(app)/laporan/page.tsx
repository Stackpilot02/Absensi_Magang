'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { PageHeader, EmptyState, TableSkeleton } from '@/components/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { NAMA_BULAN } from '@/lib/utils';
import type { RecapRow } from '@/lib/types';

export default function LaporanPage() {
  const { user } = useAuth();
  const now = useMemo(() => new Date(), []);

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<RecapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<'excel' | 'pdf' | null>(null);

  const years = useMemo(
    () => Array.from({ length: 4 }, (_, index) => now.getFullYear() - 2 + index),
    [now],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<RecapRow[]>(`/attendance/summary?year=${year}&month=${month}`);
      setRows(data);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Gagal memuat rekap kehadiran.');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  async function download(format: 'excel' | 'pdf'): Promise<void> {
    setDownloading(format);
    setError(null);
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      await api.download(
        `/reports/${format}?${params.toString()}`,
        `laporan-absensi-${month}-${year}.${format === 'excel' ? 'xlsx' : 'pdf'}`,
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Gagal mengunduh laporan.');
    } finally {
      setDownloading(null);
    }
  }

  const totals = rows.reduce(
    (accumulator, row) => ({
      hadir: accumulator.hadir + row.hadir,
      terlambat: accumulator.terlambat + row.terlambat,
      izin: accumulator.izin + row.izin,
      sakit: accumulator.sakit + row.sakit,
      alpha: accumulator.alpha + row.alpha,
    }),
    { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpha: 0 },
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Laporan Absensi"
        description="Rekap kehadiran bulanan yang siap diunduh sebagai Excel atau PDF."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void download('excel')}
              disabled={downloading !== null}
            >
              {downloading === 'excel' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-4" />
              )}
              Excel
            </Button>
            <Button size="sm" onClick={() => void download('pdf')} disabled={downloading !== null}>
              {downloading === 'pdf' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              PDF
            </Button>
          </>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="w-full space-y-1.5 sm:w-48">
            <p className="text-[12px] font-medium text-ink">Bulan</p>
            <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NAMA_BULAN.map((nama, index) => (
                  <SelectItem key={nama} value={String(index + 1)}>
                    {nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-1.5 sm:w-32">
            <p className="text-[12px] font-medium text-ink">Tahun</p>
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((item) => (
                  <SelectItem key={item} value={String(item)}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11.5px] leading-relaxed text-ink-soft sm:pb-2">
            Angka rekap mengikuti data absensi dan pengajuan izin/sakit yang telah disetujui.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>
            Rekap {NAMA_BULAN[month - 1]} {year}
          </CardTitle>
          <span className="text-[11.5px] text-ink-soft">{rows.length} peserta</span>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={6} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Belum ada data rekap"
              description="Belum ada peserta magang aktif atau data absensi pada periode ini."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead className="hidden md:table-cell">NIM</TableHead>
                  <TableHead className="text-center">Hadir</TableHead>
                  <TableHead className="text-center">Telat</TableHead>
                  <TableHead className="hidden text-center sm:table-cell">Izin</TableHead>
                  <TableHead className="hidden text-center sm:table-cell">Sakit</TableHead>
                  <TableHead className="text-center">Alpha</TableHead>
                  <TableHead className="text-right">Kehadiran</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell>
                      <p className="font-medium text-ink">{row.name}</p>
                      <p className="text-[11px] text-ink-soft md:hidden">{row.nim ?? '-'}</p>
                    </TableCell>
                    <TableCell className="hidden text-ink-soft md:table-cell">
                      {row.nim ?? '-'}
                    </TableCell>
                    <TableCell className="text-center font-medium tnum text-emerald-700">
                      {row.hadir}
                    </TableCell>
                    <TableCell className="text-center tnum text-amber-700">{row.terlambat}</TableCell>
                    <TableCell className="hidden text-center tnum sm:table-cell">{row.izin}</TableCell>
                    <TableCell className="hidden text-center tnum sm:table-cell">{row.sakit}</TableCell>
                    <TableCell className="text-center tnum text-red-600">{row.alpha}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 text-[11.5px] font-semibold text-ink tnum">
                        <span
                          className="size-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              row.persentaseKehadiran >= 80
                                ? '#059669'
                                : row.persentaseKehadiran >= 60
                                  ? '#d97706'
                                  : '#dc2626',
                          }}
                        />
                        {row.persentaseKehadiran}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <tfoot>
                <TableRow className="bg-surface/60 hover:bg-surface/60">
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="hidden md:table-cell" />
                  <TableCell className="text-center font-semibold tnum">{totals.hadir}</TableCell>
                  <TableCell className="text-center font-semibold tnum">{totals.terlambat}</TableCell>
                  <TableCell className="hidden text-center font-semibold tnum sm:table-cell">
                    {totals.izin}
                  </TableCell>
                  <TableCell className="hidden text-center font-semibold tnum sm:table-cell">
                    {totals.sakit}
                  </TableCell>
                  <TableCell className="text-center font-semibold tnum">{totals.alpha}</TableCell>
                  <TableCell className="text-right" />
                </TableRow>
              </tfoot>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          className="justify-between"
          onClick={() => void download('excel')}
          disabled={downloading !== null}
        >
          <span className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-emerald-600" />
            Unduh rekap Excel (2 sheet: rekap &amp; detail harian)
          </span>
          <Download className="size-4" />
        </Button>
        <Button
          variant="outline"
          className="justify-between"
          onClick={() => void download('pdf')}
          disabled={downloading !== null}
        >
          <span className="flex items-center gap-2">
            <FileText className="size-4 text-red-600" />
            Unduh laporan PDF siap tanda tangan
          </span>
          <Download className="size-4" />
        </Button>
      </div>

      {user?.role === 'MAGANG' && (
        <p className="text-[11.5px] text-ink-soft">
          Sebagai pegawai magang, laporan yang diunduh hanya memuat data kehadiran Anda sendiri.
        </p>
      )}
    </div>
  );
}
