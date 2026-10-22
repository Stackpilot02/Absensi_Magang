export type Role = 'ADMIN' | 'PEMBIMBING' | 'MAGANG' | 'KEPALA_BPS';

export type AttendanceStatus =
  | 'HADIR'
  | 'TERLAMBAT'
  | 'IZIN'
  | 'SAKIT'
  | 'ALPHA'
  | 'LIBUR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  nim: string | null;
  asalKampus: string | null;
  prodi: string | null;
  noHp: string | null;
  periodeMulai: string | null;
  periodeSelesai: string | null;
  mentorId: string | null;
  isActive: boolean;
}

export interface Attendance {
  id: string;
  userId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  latitudeIn: number | null;
  longitudeIn: number | null;
  latitudeOut: number | null;
  longitudeOut: number | null;
  distanceIn: number | null;
  distanceOut: number | null;
  status: AttendanceStatus;
  note: string | null;
  user?: Pick<User, 'id' | 'name' | 'nim' | 'asalKampus'>;
}

export interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  isActive: boolean;
}

export interface RecapRow {
  userId: string;
  name: string;
  nim: string | null;
  asalKampus: string | null;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpha: number;
  libur: number;
  totalHariKerja: number;
  persentaseKehadiran: number;
}

export interface DashboardSummary {
  scope: 'pegawai' | 'pengelola';
  tanggal: string;
  kantor: { name: string; latitude: number; longitude: number; radius: number } | null;
  hariIni: {
    checkIn: string | null;
    checkOut: string | null;
    status: AttendanceStatus | null;
    statusLabel: string | null;
  };
  statistik: Record<string, number>;
  trenMingguan: Array<{ tanggal: string; label: string; hadir: number; terlambat: number }>;
  aktivitasTerakhir: Array<{
    id: string;
    nama: string;
    tanggal: string;
    checkIn: string | null;
    status: AttendanceStatus;
  }>;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  type: 'IZIN' | 'SAKIT';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
  createdAt: string;
  user?: { id: string; name: string; nim: string | null };
}

export interface ActivityReport {
  id: string;
  userId: string;
  date: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'id' | 'name' | 'nim' | 'role'>;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  method: string;
  path: string;
  ip: string | null;
  createdAt: string;
  user?: { id: string; name: string; role: Role } | null;
}
