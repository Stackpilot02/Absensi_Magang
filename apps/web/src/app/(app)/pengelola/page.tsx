'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Search, UserCheck, UserX } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { PageHeader, EmptyState, TableSkeleton } from '@/components/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import type { Paginated, Role, User } from '@/lib/types';

/** Role yang dikelola di halaman ini (peserta magang ada di halaman Data Mahasiswa). */
type KelolaRole = Extract<Role, 'PEMBIMBING' | 'ADMIN' | 'KEPALA_BPS'>;

const ROLE_OPTIONS: Array<{ value: KelolaRole; label: string }> = [
  { value: 'PEMBIMBING', label: 'Pembimbing' },
  { value: 'ADMIN', label: 'Administrator' },
  { value: 'KEPALA_BPS', label: 'Kepala BPS' },
];

const ROLE_LABEL: Record<KelolaRole, string> = {
  PEMBIMBING: 'Pembimbing',
  ADMIN: 'Administrator',
  KEPALA_BPS: 'Kepala BPS',
};

const PASSWORD_HINT = 'Min. 8 karakter, harus mengandung huruf dan angka.';

interface FormState {
  name: string;
  email: string;
  username: string;
  noHp: string;
  password: string;
  role: KelolaRole;
}

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  username: '',
  noHp: '',
  password: '',
  role: 'PEMBIMBING',
};

export default function PengelolaPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [rows, setRows] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ limit: '100' });
    if (search.trim()) params.set('search', search.trim());

    try {
      const results = await Promise.all(
        ROLE_OPTIONS.map((option) =>
          api.get<Paginated<User>>(`/users?role=${option.value}&${params.toString()}`),
        ),
      );
      const merged = results
        .flatMap((result) => result.data)
        .sort((a, b) => a.name.localeCompare(b.name, 'id'));
      setRows(merged);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Gagal memuat data pengelola.',
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

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
      username: target.username ?? '',
      noHp: target.noHp ?? '',
      password: '',
      role: target.role === 'MAGANG' ? 'PEMBIMBING' : target.role,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const password = form.password.trim();
    if (!editing && !password) {
      setFormError('Password wajib diisi untuk pengelola baru.');
      setSaving(false);
      return;
    }
    if (password && !/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(password)) {
      setFormError(PASSWORD_HINT);
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
    };
    if (form.username.trim()) payload.username = form.username.trim().toLowerCase();
    if (form.noHp.trim()) payload.noHp = form.noHp.trim();
    if (password) payload.password = password;

    try {
      if (editing) {
        await api.patch(`/users/${editing.id}`, payload);
        setNotice(`Data ${form.name.trim()} berhasil diperbarui.`);
      } else {
        await api.post('/users', payload);
        setNotice(`Akun ${form.name.trim()} berhasil ditambahkan.`);
      }
      setDialogOpen(false);
      await load();
    } catch (caught) {
      setFormError(
        caught instanceof ApiError ? caught.message : 'Gagal menyimpan data pengelola.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(target: User): Promise<void> {
    const nextActive = !target.isActive;

    if (!nextActive && target.id === user?.id) {
      setError('Tidak dapat menonaktifkan akun yang sedang dipakai.');
      return;
    }

    const verb = nextActive ? 'Aktifkan' : 'Nonaktifkan';
    if (!window.confirm(`${verb} akun ${target.name}?`)) return;

    try {
      await api.patch(`/users/${target.id}`, { isActive: nextActive });
      setNotice(`Akun ${target.name} di${nextActive ? 'aktifkan' : 'nonaktifkan'}.`);
      setError(null);
      await load();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Gagal mengubah status akun.',
      );
    }
  }

  if (user && !isAdmin) {
    return (
      <div className="space-y-5">
        <PageHeader title="Pengelola" description="Manajemen akun pembimbing dan pengelola." />
        <Alert variant="error">Halaman ini hanya dapat diakses oleh Administrator.</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pengelola"
        description="Kelola akun pembimbing, administrator, dan kepala BPS. Peserta magang dikelola di halaman Data Mahasiswa."
        actions={
          isAdmin && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Tambah pengelola
            </Button>
          )
        }
      />

      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Cari nama, email, atau username…"
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
            <TableSkeleton rows={4} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Belum ada data pengelola"
              description="Tambahkan akun pembimbing agar dapat ditugaskan ke peserta magang."
              action={
                isAdmin ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="size-4" />
                    Tambah pengelola
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pengguna</TableHead>
                  <TableHead>Peran</TableHead>
                  <TableHead className="hidden sm:table-cell">Kontak</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((pengelola) => (
                  <TableRow key={pengelola.id}>
                    <TableCell>
                      <p className="font-medium text-ink">{pengelola.name}</p>
                      <p className="text-[11px] text-ink-soft">
                        {pengelola.username ?? '-'} · {pengelola.email}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">
                        {pengelola.role === 'MAGANG'
                          ? 'Pegawai Magang'
                          : ROLE_LABEL[pengelola.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-ink-soft sm:table-cell">
                      {pengelola.noHp ?? '-'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={pengelola.isActive ? 'hadir' : 'libur'}>
                        {pengelola.isActive ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(pengelola)}
                            aria-label={`Ubah data ${pengelola.name}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={
                              pengelola.isActive
                                ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                                : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                            }
                            onClick={() => void toggleActive(pengelola)}
                            aria-label={`${pengelola.isActive ? 'Nonaktifkan' : 'Aktifkan'} ${pengelola.name}`}
                          >
                            {pengelola.isActive ? (
                              <UserX className="size-4" />
                            ) : (
                              <UserCheck className="size-4" />
                            )}
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
            <DialogTitle>
              {editing ? 'Ubah data pengelola' : 'Tambah pengelola'}
            </DialogTitle>
            <DialogDescription>
              Akun ini dipakai untuk login ke aplikasi sesuai perannya.
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
              <Field label="Username (opsional)" htmlFor="username">
                <Input
                  id="username"
                  placeholder="mis. budi1221"
                  value={form.username}
                  onChange={(event) => setForm({ ...form, username: event.target.value })}
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
              <Field label="Peran" htmlFor="role">
                <Select
                  value={form.role}
                  onValueChange={(value) =>
                    setForm({ ...form, role: value as KelolaRole })
                  }
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Pilih peran" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
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
                  placeholder={editing ? 'Biarkan kosong bila tidak diubah' : PASSWORD_HINT}
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
                {editing ? 'Simpan perubahan' : 'Tambah pengelola'}
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
