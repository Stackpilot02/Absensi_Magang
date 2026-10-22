'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { EmptyState, PageHeader, Skeleton } from '@/components/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatTanggal } from '@/lib/utils';
import type { ActivityReport } from '@/lib/types';

function jakartaTodayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function jakartaTimeKey(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

/** Menampilkan hari dan tanggal dari kunci YYYY-MM-DD tanpa bergeser zona waktu. */
function formatHariTanggal(dateKey: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${dateKey.slice(0, 10)}T00:00:00+07:00`));
}

export default function KegiatanPage() {
  const { user } = useAuth();
  const isMagang = user?.role === 'MAGANG';
  const canFilter = user?.role === 'ADMIN' || user?.role === 'KEPALA_BPS';

  const [items, setItems] = useState<ActivityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [date, setDate] = useState(jakartaTodayKey());
  const [time, setTime] = useState(jakartaTimeKey());
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(
    async (filters?: { from?: string; to?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters?.from) params.set('from', filters.from);
        if (filters?.to) params.set('to', filters.to);
        const query = params.toString();
        setItems(await api.get<ActivityReport[]>(`/activities${query ? `?${query}` : ''}`));
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Gagal memuat laporan kegiatan.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm(): void {
    setDate(jakartaTodayKey());
    setTime(jakartaTimeKey());
    setDescription('');
    setEditingId(null);
    setFormError(null);
  }

  function startEdit(item: ActivityReport): void {
    setEditingId(item.id);
    setDate(item.date.slice(0, 10));
    setTime(item.time);
    setDescription(item.description);
    setFormError(null);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const text = description.trim();

    if (text.length < 5) {
      setFormError('Uraian kegiatan minimal 5 karakter.');
      return;
    }
    if (date > jakartaTodayKey()) {
      setFormError('Tanggal kegiatan tidak boleh melebihi hari ini.');
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setFormError('Jam kegiatan wajib diisi dengan format HH:mm.');
      return;
    }

    setSaving(true);
    setFormError(null);
    setNotice(null);

    try {
      if (editingId) {
        await api.patch(`/activities/${editingId}`, { date, time, description: text });
        setNotice('Laporan kegiatan berhasil diperbarui.');
      } else {
        await api.post('/activities', { date, time, description: text });
        setNotice('Laporan kegiatan berhasil disimpan.');
      }
      resetForm();
      await load();
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Gagal menyimpan laporan kegiatan.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: ActivityReport): Promise<void> {
    const confirmed = window.confirm(
      `Hapus laporan kegiatan tanggal ${formatTanggal(item.date)}?\n\nTindakan ini tidak dapat dibatalkan.`,
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    setError(null);
    setNotice(null);
    try {
      await api.delete<{ message: string }>(`/activities/${item.id}`);
      setNotice('Laporan kegiatan berhasil dihapus.');
      if (editingId === item.id) resetForm();
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Gagal menghapus laporan kegiatan.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lapor Kegiatan"
        description={
          isMagang
            ? 'Catat kegiatan atau pekerjaan yang Anda lakukan setiap hari selama magang.'
            : 'Pantau laporan kegiatan harian pegawai magang.'
        }
      />

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {isMagang && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Ubah laporan kegiatan' : 'Tulis laporan kegiatan'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[200px_130px_1fr]">
                <div className="space-y-1.5">
                  <Label htmlFor="tanggal-kegiatan">Tanggal kegiatan</Label>
                  <Input
                    id="tanggal-kegiatan"
                    type="date"
                    value={date}
                    max={jakartaTodayKey()}
                    onChange={(event) => setDate(event.target.value)}
                    required
                  />
                  <p className="text-[10.5px] text-ink-soft">
                    {date ? formatHariTanggal(date) : 'Pilih tanggal kegiatan'}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="jam-kegiatan">Jam kegiatan</Label>
                  <Input
                    id="jam-kegiatan"
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="uraian-kegiatan">Uraian kegiatan</Label>
                  <Textarea
                    id="uraian-kegiatan"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Contoh: Merekap data survei harga konsumen dan memeriksa kelengkapan berkas."
                    rows={4}
                    maxLength={1000}
                    required
                  />
                  <p className="text-right text-[10.5px] text-ink-soft">
                    {description.trim().length}/1000 karakter
                  </p>
                </div>
              </div>

              {formError && <Alert variant="error">{formError}</Alert>}

              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : editingId ? (
                    <Save className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {editingId ? 'Simpan perubahan' : 'Simpan laporan'}
                </Button>
                {editingId && (
                  <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
                    <X className="size-4" />
                    Batal
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>
            {isMagang ? 'Laporan saya' : 'Laporan kegiatan pegawai magang'}
          </CardTitle>

          {canFilter && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="filter-dari" className="text-[11px]">
                  Dari
                </Label>
                <Input
                  id="filter-dari"
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="h-8 w-36"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="filter-sampai" className="text-[11px]">
                  Sampai
                </Label>
                <Input
                  id="filter-sampai"
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="h-8 w-36"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void load({ from, to })}
              >
                Tampilkan
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFrom('');
                  setTo('');
                  void load({ from: '', to: '' });
                }}
              >
                Reset
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="Belum ada laporan kegiatan"
              description={
                isMagang
                  ? 'Tulis kegiatan pertama Anda pada formulir di atas.'
                  : 'Laporan akan muncul setelah pegawai magang mengirim kegiatan harian.'
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {items.map((item) => {
                const own = item.userId === user?.id;
                return (
                  <li key={item.id} className="px-4 py-4 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-ink">
                          <ClipboardList className="size-4 text-brand-600" />
                          {formatHariTanggal(item.date)}
                          <span className="font-normal text-ink-soft">· {item.time} WIB</span>
                          {!isMagang && item.user && (
                            <span className="font-normal text-ink-soft">
                              · {item.user.name}
                              {item.user.nim ? ` (${item.user.nim})` : ''}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[10.5px] text-ink-soft">
                          Dikirim {formatTanggal(item.createdAt)}
                          {item.updatedAt !== item.createdAt ? ' · diperbarui' : ''}
                        </p>
                      </div>

                      {own && (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            aria-label="Ubah laporan"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-surface hover:text-ink"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void remove(item)}
                            disabled={deletingId === item.id}
                            aria-label="Hapus laporan"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                          >
                            {deletingId === item.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink">
                      {item.description}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
