'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Search, UserMinus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { PageHeader, EmptyState, TableSkeleton } from '@/components/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import type { Paginated, User } from '@/lib/types';

interface FormState {
  name: string;
  email: string;
  password: string;
  nim: string;
  asalKampus: string;
  prodi: string;
  noHp: string;
  periodeMulai: string;
  periodeSelesai: string;
  mentorId: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  password: '',
  nim: '',
  asalKampus: '',
  prodi: '',
  noHp: '',
  periodeMulai: '',
  periodeSelesai: '',
  mentorId: '',
};

export default function MahasiswaPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [result, setResult] = useState<Paginated<User> | null>(null);
  const [mentors, setMentors] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ role: 'MAGANG', limit: '100' });
    if (search.trim()) params.set('search', search.trim());

    try {
      const data = await api.get<Paginated<User>>(`/users?${params.toString()}`);
      setResult(data);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Gagal memuat data peserta.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api
      .get<Paginated<User>>('/users?role=PEMBIMBING&limit=100')
      .then((data) => setMentors(data.data))
      .catch(() => setMentors([]));
  }, []);

  function openCreate(): void {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(target: User): void {
    setEditing(target);
    setForm({
      name: target.name,
      email: target.email,
      password: '',
      nim: target.nim ?? '',
      asalKampus: target.asalKampus ?? '',
      prodi: target.prodi ?? '',
      noHp: target.noHp ?? '',
      periodeMulai: target.periodeMulai?.slice(0, 10) ?? '',
      periodeSelesai: target.periodeSelesai?.slice(0, 10) ?? '',
      mentorId: target.mentorId ?? '',
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim(),
      nim: form.nim.trim() || undefined,
      asalKampus: form.asalKampus.trim() || undefined,
      prodi: form.prodi.trim() || undefined,
      noHp: form.noHp.trim() || undefined,
      periodeMulai: form.periodeMulai || undefined,
      periodeSelesai: form.periodeSelesai || undefined,
      mentorId: form.mentorId || undefined,
    };

    if (form.password) payload.password = form.password;
    if (!editing) payload.role = 'MAGANG';

    try {
      if (editing) {
        await api.patch(`/users/${editing.id}`, payload);
        setNotice('Data peserta berhasil diperbarui.');
      } else {
        if (!form.password) {
          setFormError('Password wajib diisi untuk peserta baru.');
          setSaving(false);
          return;
        }
        await api.post('/users', payload);
        setNotice('Peserta magang berhasil ditambahkan.');
      }
      setDialogOpen(false);
      await load();
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Gagal menyimpan data peserta.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(target: User): Promise<void> {
    if (!window.confirm(`Nonaktifkan akun ${target.name}? Riwayat absensi tetap tersimpan.`)) return;

    try {
      await api.delete(`/users/${target.id}`);
      setNotice('Akun peserta dinonaktifkan.');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Gagal menonaktifkan akun.');
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Data Mahasiswa Magang"
        description="Kelola data peserta: identitas, asal kampus, program studi, kontak, dan periode magang."
        actions={
          isAdmin && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Tambah peserta
            </Button>
          )
        }
      />

      {notice && (
        <Alert variant="success">{notice}</Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Cari nama, NIM, atau kampus…"
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={6} />
          ) : !result || result.data.length === 0 ? (
            <EmptyState
              title="Belum ada peserta magang"
              description="Tambahkan data peserta untuk mulai mencatat absensi."
              action={
                isAdmin ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="size-4" />
                    Tambah peserta
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peserta</TableHead>
                  <TableHead className="hidden md:table-cell">Kampus / Prodi</TableHead>
                  <TableHead className="hidden lg:table-cell">Periode magang</TableHead>
                  <TableHead className="hidden sm:table-cell">Kontak</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.map((peserta) => (
                  <TableRow key={peserta.id}>
                    <TableCell>
                      <p className="font-medium text-ink">{peserta.name}</p>
                      <p className="text-[11px] text-ink-soft">
                        {peserta.nim ?? '-'} · {peserta.email}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="text-[12.5px] text-ink">{peserta.asalKampus ?? '-'}</p>
                      <p className="text-[11px] text-ink-soft">{peserta.prodi ?? '-'}</p>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-ink-soft lg:table-cell">
                      {formatTanggal(peserta.periodeMulai)} —{' '}
                      {formatTanggal(peserta.periodeSelesai)}
                    </TableCell>
                    <TableCell className="hidden text-ink-soft sm:table-cell">
                      {peserta.noHp ?? '-'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={peserta.isActive ? 'hadir' : 'libur'}>
                        {peserta.isActive ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(peserta)}
                            aria-label={`Ubah data ${peserta.name}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => void handleDeactivate(peserta)}
                            aria-label={`Nonaktifkan ${peserta.name}`}
                          >
                            <UserMinus className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Ubah data peserta' : 'Tambah peserta magang'}</DialogTitle>
            <DialogDescription>
              Data ini digunakan untuk login, rekap absensi, dan laporan bulanan.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3">
            {formError && <Alert variant="error">{formError}</Alert>}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nama lengkap" htmlFor="name">
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </Field>
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                />
              </Field>
              <Field label="NIM" htmlFor="nim">
                <Input
                  id="nim"
                  value={form.nim}
                  onChange={(event) => setForm({ ...form, nim: event.target.value })}
                />
              </Field>
              <Field label="No. HP" htmlFor="noHp">
                <Input
                  id="noHp"
                  placeholder="08xxxxxxxxxx"
                  value={form.noHp}
                  onChange={(event) => setForm({ ...form, noHp: event.target.value })}
                />
              </Field>
              <Field label="Asal kampus" htmlFor="asalKampus">
                <Input
                  id="asalKampus"
                  value={form.asalKampus}
                  onChange={(event) => setForm({ ...form, asalKampus: event.target.value })}
                />
              </Field>
              <Field label="Program studi" htmlFor="prodi">
                <Input
                  id="prodi"
                  value={form.prodi}
                  onChange={(event) => setForm({ ...form, prodi: event.target.value })}
                />
              </Field>
              <Field label="Mulai magang" htmlFor="periodeMulai">
                <Input
                  id="periodeMulai"
                  type="date"
                  value={form.periodeMulai}
                  onChange={(event) => setForm({ ...form, periodeMulai: event.target.value })}
                />
              </Field>
              <Field label="Selesai magang" htmlFor="periodeSelesai">
                <Input
                  id="periodeSelesai"
                  type="date"
                  min={form.periodeMulai}
                  value={form.periodeSelesai}
                  onChange={(event) => setForm({ ...form, periodeSelesai: event.target.value })}
                />
              </Field>
              <Field label="Pembimbing" htmlFor="mentorId">
                <Select
                  value={form.mentorId || 'NONE'}
                  onValueChange={(value) =>
                    setForm({ ...form, mentorId: value === 'NONE' ? '' : value })
                  }
                >
                  <SelectTrigger id="mentorId">
                    <SelectValue placeholder="Pilih pembimbing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Belum ditentukan</SelectItem>
                    {mentors.map((mentor) => (
                      <SelectItem key={mentor.id} value={mentor.id}>
                        {mentor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label={editing ? 'Password baru (opsional)' : 'Password'}
                htmlFor="password"
              >
                <Input
                  id="password"
                  type="password"
                  placeholder={editing ? 'Biarkan kosong bila tidak diubah' : 'Min. 8 karakter'}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  required={!editing}
                />
              </Field>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {editing ? 'Simpan perubahan' : 'Tambah peserta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
