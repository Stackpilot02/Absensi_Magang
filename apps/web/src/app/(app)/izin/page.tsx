'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, Check, Loader2, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { PageHeader, EmptyState, TableSkeleton } from '@/components/page-header';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { formatTanggal } from '@/lib/utils';
import type { LeaveRequest } from '@/lib/types';

export default function IzinPage() {
  const { user } = useAuth();
  const isPengelola =
    user?.role === 'ADMIN' || user?.role === 'PEMBIMBING' || user?.role === 'KEPALA_BPS';
  const canReview = user?.role === 'ADMIN' || user?.role === 'PEMBIMBING';

  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'IZIN' | 'SAKIT'>('IZIN');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.get<LeaveRequest[]>('/leaves'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Gagal memuat pengajuan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      await api.post('/leaves', { type, startDate, endDate, reason: reason.trim() });
      setOpen(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      setNotice('Pengajuan berhasil dikirim dan menunggu persetujuan pembimbing.');
      await load();
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Gagal mengirim pengajuan.');
    } finally {
      setSaving(false);
    }
  }

  async function review(id: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
    try {
      await api.patch(`/leaves/${id}/review`, { status });
      setNotice(
        status === 'APPROVED' ? 'Pengajuan disetujui.' : 'Pengajuan ditolak.',
      );
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Gagal memproses pengajuan.');
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Izin & Sakit"
        description={
          canReview
            ? 'Tinjau pengajuan izin atau sakit pegawai magang yang Anda bimbing.'
            : 'Ajukan izin atau sakit agar tidak dihitung sebagai alpha pada rekap kehadiran.'
        }
        actions={
          !isPengelola && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <CalendarPlus className="size-4" />
              Ajukan izin/sakit
            </Button>
          )
        }
      />

      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={4} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Belum ada pengajuan"
              description="Pengajuan izin atau sakit akan muncul di sini."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isPengelola && <TableHead>Pegawai</TableHead>}
                  <TableHead>Jenis</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="hidden md:table-cell">Alasan</TableHead>
                  <TableHead>Status</TableHead>
                  {canReview && <TableHead className="text-right">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    {isPengelola && (
                      <TableCell>
                        <p className="font-medium text-ink">{item.user?.name ?? '-'}</p>
                        <p className="text-[11px] text-ink-soft">{item.user?.nim ?? '-'}</p>
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="text-[12.5px] font-medium">{item.type}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-ink-soft">
                      {formatTanggal(item.startDate)}
                      {item.startDate !== item.endDate && ` — ${formatTanggal(item.endDate)}`}
                    </TableCell>
                    <TableCell className="hidden max-w-xs md:table-cell">
                      <p className="line-clamp-2 text-[12.5px] text-ink-soft">{item.reason}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    {canReview && (
                      <TableCell>
                        {item.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-emerald-700 hover:bg-emerald-50"
                              onClick={() => void review(item.id, 'APPROVED')}
                            >
                              <Check className="size-3.5" />
                              Setujui
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => void review(item.id, 'REJECTED')}
                            >
                              <X className="size-3.5" />
                              Tolak
                            </Button>
                          </div>
                        ) : (
                          <p className="text-right text-[11px] text-slate-400">Selesai</p>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajukan izin atau sakit</DialogTitle>
            <DialogDescription>
              Pengajuan yang disetujui akan menggantikan status Alpha pada rekap kehadiran.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3">
            {formError && <Alert variant="error">{formError}</Alert>}

            <div className="space-y-1.5">
              <Label>Jenis pengajuan</Label>
              <Select value={type} onValueChange={(value) => setType(value as 'IZIN' | 'SAKIT')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IZIN">Izin</SelectItem>
                  <SelectItem value="SAKIT">Sakit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Tanggal mulai</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">Tanggal selesai</Label>
                <Input
                  id="endDate"
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reason">Alasan</Label>
              <Textarea
                id="reason"
                placeholder="Jelaskan alasan pengajuan, misalnya kegiatan kampus atau surat dokter."
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                required
              />
            </div>

            <DialogFooter className="pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Kirim pengajuan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
