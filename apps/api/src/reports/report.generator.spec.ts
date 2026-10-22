import { buildRecapExcel } from './excel.generator';
import { buildRecapPdf } from './pdf.generator';
import { periodLabel, ReportData } from './report.types';

const DATA: ReportData = {
  officeName: 'Kantor BPS Kabupaten Padang Lawas',
  generatedAt: new Date('2026-10-22T03:00:00.000Z'),
  generatedBy: 'Administrator BPS',
  month: 10,
  year: 2026,
  recap: [
    {
      userId: 'user-1',
      name: 'Siti Nurhaliza',
      nim: '2021110001',
      asalKampus: 'UIN Syekh Ali Hasan Ahmad Addary',
      hadir: 18,
      terlambat: 2,
      izin: 1,
      sakit: 0,
      alpha: 0,
      libur: 8,
      totalHariKerja: 21,
      persentaseKehadiran: 95.2,
    },
  ],
  details: [
    {
      userId: 'user-1',
      name: 'Siti Nurhaliza',
      nim: '2021110001',
      asalKampus: 'UIN Syekh Ali Hasan Ahmad Addary',
      prodi: 'Statistika',
      rows: [
        {
          tanggal: '2026-10-01',
          hari: 'Kamis',
          masuk: '08:02',
          keluar: '16:05',
          status: 'HADIR',
          statusLabel: 'Hadir',
          keterangan: null,
        },
      ],
    },
  ],
};

describe('generator laporan', () => {
  it('memberi label periode dalam Bahasa Indonesia', () => {
    expect(periodLabel(10, 2026)).toBe('Oktober 2026');
    expect(periodLabel(1, 2026)).toBe('Januari 2026');
  });

  it('membuat berkas Excel yang valid (zip xlsx)', async () => {
    const buffer = await buildRecapExcel(DATA);

    expect(buffer.length).toBeGreaterThan(1000);
    // Berkas xlsx adalah arsip ZIP -> diawali "PK".
    expect(buffer.subarray(0, 2).toString('utf8')).toBe('PK');
  });

  it('membuat berkas PDF yang valid', async () => {
    const buffer = await buildRecapPdf(DATA);

    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(buffer.toString('utf8')).toContain('%%EOF');
  });
});
