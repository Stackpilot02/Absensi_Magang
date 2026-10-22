'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Loader2, Save, ShieldCheck, UserRound } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { PageHeader } from '@/components/page-header';
import { ROLE_LABEL } from '@/components/app-shell';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatTanggal, initials } from '@/lib/utils';

export default function ProfilPage() {
  const { user, refresh } = useAuth();

  const [name, setName] = useState('');
  const [noHp, setNoHp] = useState('');
  const [asalKampus, setAsalKampus] = useState('');
  const [prodi, setProdi] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [passwordLama, setPasswordLama] = useState('');
  const [passwordBaru, setPasswordBaru] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setNoHp(user.noHp ?? '');
    setAsalKampus(user.asalKampus ?? '');
    setProdi(user.prodi ?? '');
  }, [user]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSavingProfile(true);
    setProfileNotice(null);
    setProfileError(null);

    try {
      await api.patch('/users/me', {
        name: name.trim(),
        noHp: noHp.trim() || undefined,
        asalKampus: asalKampus.trim() || undefined,
        prodi: prodi.trim() || undefined,
      });
      await refresh();
      setProfileNotice('Profil berhasil diperbarui.');
    } catch (caught) {
      setProfileError(caught instanceof ApiError ? caught.message : 'Gagal memperbarui profil.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPasswordNotice(null);
    setPasswordError(null);

    if (passwordBaru !== confirmPassword) {
      setPasswordError('Konfirmasi password baru tidak sama.');
      return;
    }

    setSavingPassword(true);
    try {
      const result = await api.post<{ message: string }>('/auth/change-password', {
        passwordLama,
        passwordBaru,
      });
      setPasswordNotice(result.message);
      setPasswordLama('');
      setPasswordBaru('');
      setConfirmPassword('');
    } catch (caught) {
      setPasswordError(caught instanceof ApiError ? caught.message : 'Gagal mengubah password.');
    } finally {
      setSavingPassword(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Profil Saya"
        description="Perbarui data diri dan keamanan akun Anda."
      />

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-600 text-xl font-bold text-white">
            {initials(user.name)}
          </span>
          <div className="flex-1">
            <p className="text-lg font-bold tracking-tight text-ink">{user.name}</p>
            <p className="text-[13px] text-ink-soft">{user.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge>{ROLE_LABEL[user.role]}</Badge>
              {user.nim && <Badge variant="outline">NIM {user.nim}</Badge>}
              <Badge variant={user.isActive ? 'hadir' : 'libur'}>
                {user.isActive ? 'Akun aktif' : 'Akun nonaktif'}
              </Badge>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] sm:text-right">
            <div>
              <dt className="text-ink-soft">Mulai magang</dt>
              <dd className="font-medium text-ink">{formatTanggal(user.periodeMulai)}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">Selesai magang</dt>
              <dd className="font-medium text-ink">{formatTanggal(user.periodeSelesai)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4 text-brand-600" />
              Data diri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-3">
              {profileNotice && <Alert variant="success">{profileNotice}</Alert>}
              {profileError && <Alert variant="error">{profileError}</Alert>}

              <div className="space-y-1.5">
                <Label htmlFor="name">Nama lengkap</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email} disabled />
                <p className="text-[11px] text-ink-soft">
                  Email hanya dapat diubah oleh administrator.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="noHp">No. HP</Label>
                <Input
                  id="noHp"
                  placeholder="08xxxxxxxxxx"
                  value={noHp}
                  onChange={(event) => setNoHp(event.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="asalKampus">Asal kampus</Label>
                  <Input
                    id="asalKampus"
                    value={asalKampus}
                    onChange={(event) => setAsalKampus(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prodi">Program studi</Label>
                  <Input
                    id="prodi"
                    value={prodi}
                    onChange={(event) => setProdi(event.target.value)}
                  />
                </div>
              </div>

              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Simpan perubahan
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-brand-600" />
              Keamanan akun
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="space-y-3">
              {passwordNotice && <Alert variant="success">{passwordNotice}</Alert>}
              {passwordError && <Alert variant="error">{passwordError}</Alert>}

              <div className="space-y-1.5">
                <Label htmlFor="passwordLama">Password saat ini</Label>
                <Input
                  id="passwordLama"
                  type="password"
                  autoComplete="current-password"
                  value={passwordLama}
                  onChange={(event) => setPasswordLama(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="passwordBaru">Password baru</Label>
                <Input
                  id="passwordBaru"
                  type="password"
                  autoComplete="new-password"
                  value={passwordBaru}
                  onChange={(event) => setPasswordBaru(event.target.value)}
                  minLength={8}
                  required
                />
                <p className="text-[11px] text-ink-soft">
                  Minimal 8 karakter, kombinasi huruf dan angka.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Ulangi password baru</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>

              <Button type="submit" variant="outline" disabled={savingPassword}>
                {savingPassword ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                Ubah password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
