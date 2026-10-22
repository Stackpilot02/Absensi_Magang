import type { RecapRow } from '../attendance/attendance.service';

export interface DailyRow {
  tanggal: string;
  hari: string;
  masuk: string | null;
  keluar: string | null;
  status: string;
  statusLabel: string;
  keterangan: string | null;
}

export interface ReportUserDetail {
  userId: string;
  name: string;
  nim: string | null;
  asalKampus: string | null;
  prodi: string | null;
  rows: DailyRow[];
}

export interface ReportData {
  officeName: string;
  generatedAt: Date;
  generatedBy: string;
  month: number;
  year: number;
  recap: RecapRow[];
  details: ReportUserDetail[];
}

export const BULAN_INDONESIA = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function periodLabel(month: number, year: number): string {
  return `${BULAN_INDONESIA[month - 1] ?? month} ${year}`;
}
