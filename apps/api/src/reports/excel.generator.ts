import ExcelJS from 'exceljs';
import { ReportData, periodLabel, BULAN_INDONESIA } from './report.types';

const HEADER_FILL = 'FF005BAA';

function styleHeaderRow(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  row.height = 28;
}

/** Membuat berkas Excel berisi sheet Rekap dan Detail Harian. */
export async function buildRecapExcel(data: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistem Absensi BPS Kabupaten Padang Lawas';
  workbook.created = data.generatedAt;

  const recapSheet = workbook.addWorksheet('Rekap');
  recapSheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Nama', key: 'name', width: 28 },
    { header: 'NIM', key: 'nim', width: 16 },
    { header: 'Asal Kampus', key: 'kampus', width: 26 },
    { header: 'Hadir', key: 'hadir', width: 9 },
    { header: 'Terlambat', key: 'terlambat', width: 11 },
    { header: 'Izin', key: 'izin', width: 8 },
    { header: 'Sakit', key: 'sakit', width: 8 },
    { header: 'Alpha', key: 'alpha', width: 8 },
    { header: 'Libur', key: 'libur', width: 8 },
    { header: 'Kehadiran (%)', key: 'persen', width: 15 },
  ];

  recapSheet.mergeCells('A1:K1');
  recapSheet.getCell('A1').value = 'BADAN PUSAT STATISTIK KABUPATEN PADANG LAWAS';
  recapSheet.getCell('A1').font = { bold: true, size: 14 };
  recapSheet.getCell('A1').alignment = { horizontal: 'center' };

  recapSheet.mergeCells('A2:K2');
  recapSheet.getCell('A2').value = `REKAP ABSENSI PEGAWAI MAGANG - ${periodLabel(data.month, data.year)}`;
  recapSheet.getCell('A2').font = { bold: true, size: 12 };
  recapSheet.getCell('A2').alignment = { horizontal: 'center' };

  recapSheet.mergeCells('A3:K3');
  recapSheet.getCell('A3').value = `Lokasi: ${data.officeName}`;
  recapSheet.getCell('A3').alignment = { horizontal: 'center' };

  recapSheet.addRow([]);
  const headerRow = recapSheet.addRow([
    'No',
    'Nama',
    'NIM',
    'Asal Kampus',
    'Hadir',
    'Terlambat',
    'Izin',
    'Sakit',
    'Alpha',
    'Libur',
    'Kehadiran (%)',
  ]);
  styleHeaderRow(headerRow);

  data.recap.forEach((item, index) => {
    const row = recapSheet.addRow([
      index + 1,
      item.name,
      item.nim ?? '-',
      item.asalKampus ?? '-',
      item.hadir,
      item.terlambat,
      item.izin,
      item.sakit,
      item.alpha,
      item.libur,
      item.persentaseKehadiran,
    ]);
    row.alignment = { vertical: 'middle' };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'hair' },
        left: { style: 'hair' },
        bottom: { style: 'hair' },
        right: { style: 'hair' },
      };
    });
  });

  recapSheet.addRow([]);
  recapSheet.addRow([`Dicetak: ${data.generatedAt.toISOString()} oleh ${data.generatedBy}`]);

  const detailSheet = workbook.addWorksheet('Detail Harian');
  detailSheet.columns = [
    { header: 'Tanggal', key: 'tanggal', width: 14 },
    { header: 'Hari', key: 'hari', width: 12 },
    { header: 'Masuk', key: 'masuk', width: 10 },
    { header: 'Keluar', key: 'keluar', width: 10 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Keterangan', key: 'keterangan', width: 40 },
  ];
  styleHeaderRow(detailSheet.getRow(1));

  for (const detail of data.details) {
    const title = detailSheet.addRow([`${detail.name} (${detail.nim ?? '-'})`]);
    title.font = { bold: true };
    detailSheet.mergeCells(`A${title.number}:F${title.number}`);

    for (const row of detail.rows) {
      detailSheet.addRow([
        row.tanggal,
        row.hari,
        row.masuk ?? '-',
        row.keluar ?? '-',
        row.statusLabel,
        row.keterangan ?? '-',
      ]);
    }
    detailSheet.addRow([]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export { BULAN_INDONESIA };
