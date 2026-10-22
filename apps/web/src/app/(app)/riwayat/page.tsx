'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { PageHeader, EmptyState, TableSkeleton } from '@/components/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/badge';
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
import { formatJarak, formatJam, formatTanggal } from '@/lib/utils';
import type { Attendance, Paginated, Role } from '@/lib/types';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Semua status' },
  { value: 'HADIR', label: 'Hadir' },
  { value: 'TERLAMBAT', label: 'Terlambat' },
  { value: 'IZIN', label: 'Izin' },
  { value: 'SAKIT', label: 'Sakit' },
  { value: 'ALPHA', label: 'Alpha' },
];

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default function RiwayatPage() {
  const { user } = useAuth();
  const now = useMemo(() => new Date(), []);
  const firstDay = useMemo(() => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), [now]);

  const [from, setFrom] = useState(isoDate(firstDay));
  const [to, setTo] = useState(isoDate(now));
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Attendance> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      from,
      to,
      page: String(page),
      limit: '10',
    });
    if (status !== 'ALL') params.set('status', status);

    try {
      const data = await api.get<Paginated<Attendance>>(`/attendance/history?${params.toString()}`);
      setResult(data);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Gagal memuat riwayat absensi.');
    } finally {
      setLoading(false);
    }
  }, [from, to, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const role = user?.role as Role | undefined;
  const isPengelola = role === 'ADMIN' || role === 'PEMBIMBING' || role === 'KEPALA_BPS';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Riwayat Absensi"
        description={
          isPengelola
            ? 'Riwayat kehadiran pegawai magang beserta jarak lokasi saat absensi.'
            : 'Catatan kehadiran harian Anda, termasuk lokasi dan waktu absensi.'
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="from">Dari tanggal</Label>
            <Input
              id="from"
              type="date"
              value={from}
              max={to}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="to">Sampai tanggal</Label>
            <Input
              id="to"
              type="date"
              value={to}
              min={from}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" className="sm:mb-0" onClick={() => void load()}>
            <Search className="size-4" />
            Terapkan
          </Button>
        </CardContent>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={6} />
          ) : !result || result.data.length === 0 ? (
            <EmptyState
              title="Tidak ada data absensi"
              description="Belum ada absensi pada rentang tanggal yang dipilih."
              action={
                <Button variant="outline" size="sm" onClick={() => void load()}>
                  <CalendarRange className="size-4" />
                  Muat ulang
                </Button>
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {isPengelola && <TableHead>Pegawai</TableHead>}
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Masuk</TableHead>
                    <TableHead>Keluar</TableHead>
                    <TableHead className="hidden sm:table-cell">Jarak</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.data.map((item) => (
                    <TableRow key={item.id}>
                      {isPengelola && (
                        <TableCell>
                          <p className="font-medium text-ink">{item.user?.name ?? '-'}</p>
                          <p className="text-[11px] text-ink-soft">{item.user?.nim ?? '-'}</p>
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap text-ink-soft">
                        {formatTanggal(item.date)}
                      </TableCell>
                      <TableCell className="tnum">{formatJam(item.checkIn)}</TableCell>
                      <TableCell className="tnum">{formatJam(item.checkOut)}</TableCell>
                      <TableCell className="hidden text-ink-soft sm:table-cell">
                        {formatJarak(item.distanceIn)}
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge status={item.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {result && result.meta.total > 0 && (
        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-[12px] text-ink-soft">
            Menampilkan {(result.meta.page - 1) * result.meta.limit + 1}–
            {Math.min(result.meta.page * result.meta.limit, result.meta.total)} dari{' '}
            {result.meta.total} data
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={result.meta.page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft className="size-4" />
              Sebelumnya
            </Button>
            <span className="text-[12px] font-medium text-ink">
              {result.meta.page} / {result.meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={result.meta.page >= result.meta.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Berikutnya
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
