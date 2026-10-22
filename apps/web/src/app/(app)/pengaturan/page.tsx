'use client';

import { useCallback, useEffect, useState } from 'react';
import { Crosshair, Loader2, MapPin, Pencil, Plus, ScrollText, ShieldAlert } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { PageHeader, EmptyState, TableSkeleton } from '@/components/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getCurrentPosition } from '@/lib/geolocation';
import { formatTanggal, formatJam } from '@/lib/utils';
import type { AuditLog, OfficeLocation, Paginated } from '@/lib/types';

interface OfficeForm {
  name: string;
  latitude: string;
  longitude: string;
  radius: string;
}

const EMPTY_OFFICE: OfficeForm = { name: '', latitude: '', longitude: '', radius: '100' };

export default function PengaturanPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [offices, setOffices] = useState<OfficeLocation[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OfficeLocation | null>(null);
  const [form, setForm] = useState<OfficeForm>(EMPTY_OFFICE);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const [logs, setLogs] = useState<Paginated<AuditLog> | null>(null);
  const [logPage, setLogPage] = useState(1);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const loadOffices = useCallback(async () => {
    setLoadingOffices(true);
    try {
      setOffices(await api.get<OfficeLocation[]>('/office-locations'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Gagal memuat lokasi kantor.');
    } finally {
      setLoadingOffices(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      setLogs(await api.get<Paginated<AuditLog>>(`/audit-logs?page=${logPage}&limit=10`));
    } catch {
      setLogs(null);
    } finally {
      setLoadingLogs(false);
    }
  }, [logPage]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadOffices();
    void loadLogs();
  }, [isAdmin, loadOffices, loadLogs]);

  function openCreate(): void {
    setEditing(null);
    setForm(EMPTY_OFFICE);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(office: OfficeLocation): void {
    setEditing(office);
    setForm({
      name: office.name,
      latitude: String(office.latitude),
      longitude: String(office.longitude),
      radius: String(office.radius),
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function useCurrentLocation(): Promise<void> {
    setLocating(true);
    setFormError(null);
    try {
      const position = await getCurrentPosition();
      setForm((current) => ({
        ...current,
        latitude: position.latitude.toFixed(6),
        longitude: position.longitude.toFixed(6),
      }));
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Gagal mengambil lokasi.');
    } finally {
      setLocating(false);
    }
  }

  async function saveOffice(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const payload = {
      name: form.name.trim(),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      radius: Number(form.radius),
    };

    try {
      if (editing) {
        await api.patch(`/office-locations/${editing.id}`, payload);
        setNotice('Lokasi kantor diperbarui.');
      } else {
        await api.post('/office-locations', payload);
        setNotice('Lokasi kantor ditambahkan.');
      }
      setDialogOpen(false);
      await loadOffices();
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Gagal menyimpan lokasi kantor.');
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader title="Pengaturan" />
        <Alert variant="error">
          <span className="flex items-center gap-2">
            <ShieldAlert className="size-4" /> Halaman ini hanya dapat diakses administrator.
          </span>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pengaturan Sistem"
        description="Atur titik lokasi dan radius absensi, serta pantau jejak audit aktivitas pengguna."
      />

      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-4 text-brand-600" />
            Lokasi &amp; radius kantor
          </CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Tambah lokasi
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingOffices ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-28 animate-pulse rounded-xl bg-slate-200/60" />
              <div className="h-28 animate-pulse rounded-xl bg-slate-200/60" />
            </div>
          ) : offices.length === 0 ? (
            <EmptyState
              title="Belum ada lokasi kantor"
              description="Tambahkan lokasi kantor agar pegawai dapat melakukan absensi."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="size-4" />
                  Tambah lokasi
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {offices.map((office) => (
                <div
                  key={office.id}
                  className="flex flex-col justify-between rounded-xl border border-line p-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13.5px] font-semibold text-ink">{office.name}</p>
                      <Badge variant={office.isActive ? 'hadir' : 'libur'}>
                        {office.isActive ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11.5px] text-ink-soft">
                      {office.latitude.toFixed(6)}, {office.longitude.toFixed(6)}
                    </p>
                    <p className="mt-2 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-semibold text-brand-700">
                      Radius {office.radius} m
                    </p>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(office)}>
                      <Pencil className="size-3.5" />
                      Ubah
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="size-4 text-brand-600" />
            Audit log
          </CardTitle>
          <span className="text-[11.5px] text-ink-soft">{logs?.meta.total ?? 0} catatan</span>
        </CardHeader>
        <CardContent className="p-0">
          {loadingLogs ? (
            <TableSkeleton rows={5} />
          ) : !logs || logs.data.length === 0 ? (
            <EmptyState title="Belum ada catatan audit" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Pengguna</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead className="hidden sm:table-cell">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-ink-soft">
                      {formatTanggal(log.createdAt)} {formatJam(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-ink">{log.user?.name ?? 'Sistem'}</p>
                      <p className="text-[11px] text-ink-soft">{log.user?.role ?? '-'}</p>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate font-mono text-[11.5px] text-ink">{log.action}</p>
                      <p className="truncate text-[10.5px] text-ink-soft">{log.path}</p>
                    </TableCell>
                    <TableCell className="hidden text-ink-soft sm:table-cell">
                      {log.ip ?? '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {logs && logs.meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={logPage <= 1}
            onClick={() => setLogPage((value) => Math.max(1, value - 1))}
          >
            Sebelumnya
          </Button>
          <span className="text-[12px] font-medium text-ink">
            {logPage} / {logs.meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={logPage >= logs.meta.totalPages}
            onClick={() => setLogPage((value) => value + 1)}
          >
            Berikutnya
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Ubah lokasi kantor' : 'Tambah lokasi kantor'}</DialogTitle>
            <DialogDescription>
              Titik koordinat dan radius menjadi acuan validasi geofencing absensi.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveOffice} className="space-y-3">
            {formError && <Alert variant="error">{formError}</Alert>}

            <div className="space-y-1.5">
              <Label htmlFor="officeName">Nama lokasi</Label>
              <Input
                id="officeName"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Kantor BPS Kabupaten Padang Lawas"
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  inputMode="decimal"
                  value={form.latitude}
                  onChange={(event) => setForm({ ...form, latitude: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  inputMode="decimal"
                  value={form.longitude}
                  onChange={(event) => setForm({ ...form, longitude: event.target.value })}
                  required
                />
              </div>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={() => void useCurrentLocation()}>
              {locating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Crosshair className="size-3.5" />
              )}
              Gunakan lokasi perangkat saat ini
            </Button>

            <div className="space-y-1.5">
              <Label htmlFor="radius">Radius absensi (meter)</Label>
              <Input
                id="radius"
                type="number"
                min={10}
                max={5000}
                value={form.radius}
                onChange={(event) => setForm({ ...form, radius: event.target.value })}
                required
              />
              <p className="text-[11px] text-ink-soft">
                Default 100 meter sesuai kebijakan kantor.
              </p>
            </div>

            <DialogFooter className="pt-1">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
