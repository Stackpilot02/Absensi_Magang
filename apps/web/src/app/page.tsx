'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AtSign, Eye, EyeOff, Loader2, LockKeyhole, MapPinCheck, ShieldCheck } from 'lucide-react';
import { BrandLockup, BrandMark } from '@/components/brand';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/auth-provider';
import { ApiError } from '@/lib/api';

const FEATURES = [
  {
    icon: MapPinCheck,
    title: 'Validasi lokasi kantor',
    description: 'Absensi hanya tercatat di dalam radius kantor (geofencing 100 meter).',
  },
  {
    icon: ShieldCheck,
    title: 'Anti manipulasi waktu',
    description: 'Jam server menjadi acuan, selisih jam perangkat otomatis terdeteksi.',
  },
];

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showDemo = process.env.NEXT_PUBLIC_SHOW_DEMO_HINTS === 'true';

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(identifier.trim(), password);
      router.replace('/dashboard');
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
      } else {
        setError('Gagal masuk. Silakan coba lagi.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Panel identitas */}
      <section className="relative hidden overflow-hidden bg-brand-800 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 grid-pattern opacity-70" />
        <div
          className="absolute -right-24 top-1/3 size-[420px] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #7FC4FF 0%, transparent 65%)' }}
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <BrandMark className="size-11 ring-1 ring-white/20" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-100">
                Badan Pusat Statistik
              </p>
              <p className="text-[15px] font-bold tracking-tight">Kabupaten Padang Lawas</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-lg">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-brand-100">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Sistem internal pegawai magang
          </p>
          <h1 className="text-[34px] font-extrabold leading-[1.15] tracking-[-0.03em]">
            Absensi magang yang rapi, terukur, dan dapat dipertanggungjawabkan.
          </h1>
          <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-brand-100/90">
            Satu tempat untuk mencatat kehadiran harian, memantau peserta magang, dan menyusun
            laporan bulanan tanpa rekap manual.
          </p>

          <ul className="mt-8 space-y-4">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <feature.icon className="size-4 text-brand-100" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold">{feature.title}</p>
                  <p className="text-[12px] leading-relaxed text-brand-100/80">
                    {feature.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-brand-100/60">
          © {new Date().getFullYear()} BPS Kabupaten Padang Lawas
        </p>
      </section>

      {/* Panel form */}
      <section className="flex min-h-dvh flex-col items-center justify-center bg-white px-5 py-10 sm:px-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 lg:hidden">
            <BrandLockup />
          </div>

          <p className="label-caps">Masuk ke akun</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">Selamat datang kembali</h2>
          <p className="mt-1.5 text-[13px] text-ink-soft">
            Gunakan email atau username dan password yang diberikan admin BPS.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
            {error && <Alert variant="error">{error}</Alert>}

            <div className="space-y-1.5">
              <Label htmlFor="identifier">Email atau Username</Label>
              <div className="relative">
                <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="contoh: dian1221"
                  className="h-11 pl-9"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-11 pl-9 pr-10"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-surface hover:text-ink"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Memproses…
                </>
              ) : (
                'Masuk'
              )}
            </Button>
          </form>

          {showDemo && (
            <div className="mt-6 rounded-xl border border-dashed border-line bg-surface p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                Akun demo
              </p>
              <ul className="mt-2 space-y-1 text-[11.5px] text-ink-soft">
                <li>
                  <span className="font-medium text-ink">Admin:</span> admin@padanglawas.bps.go.id
                </li>
                <li>
                  <span className="font-medium text-ink">Magang:</span> dian1221
                </li>
                <li>
                  <span className="font-medium text-ink">Password:</span> bps1221
                </li>
              </ul>
            </div>
          )}

          <p className="mt-8 text-center text-[11px] leading-relaxed text-slate-400">
            Dengan masuk, Anda menyetujui penggunaan data untuk keperluan administrasi magang BPS.
          </p>
        </div>
      </section>
    </main>
  );
}
