import PDFDocument from 'pdfkit';
import { ReportData, periodLabel } from './report.types';

const PRIMARY = '#005BAA';
const TEXT = '#1F2937';
const MUTED = '#6B7280';

/**
 * Membuat laporan PDF rekap absensi.
 * PDFKit ditulis ke buffer agar bisa langsung dikirim sebagai response HTTP.
 */
export function buildRecapPdf(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Laporan Absensi ${periodLabel(data.month, data.year)}`,
          Author: 'BPS Kabupaten Padang Lawas',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header institusi
      doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(14)
        .text('BADAN PUSAT STATISTIK', { align: 'center' })
        .text('KABUPATEN PADANG LAWAS', { align: 'center' });
      doc.moveDown(0.3);
      doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(12)
        .text(`LAPORAN ABSENSI PEGAWAI MAGANG`, { align: 'center' })
        .text(`PERIODE ${periodLabel(data.month, data.year).toUpperCase()}`, { align: 'center' });
      doc.moveDown(0.2);
      doc.fillColor(MUTED).font('Helvetica').fontSize(9)
        .text(`Lokasi absensi: ${data.officeName}`, { align: 'center' });
      doc.moveDown(0.8);

      // Tabel rekap
      const startX = 40;
      let y = doc.y;
      const columns = [
        { label: 'No', width: 26 },
        { label: 'Nama', width: 140 },
        { label: 'NIM', width: 70 },
        { label: 'Hadir', width: 38 },
        { label: 'Telat', width: 38 },
        { label: 'Izin', width: 36 },
        { label: 'Sakit', width: 38 },
        { label: 'Alpha', width: 38 },
        { label: 'Libur', width: 38 },
        { label: '%', width: 42 },
      ];
      const tableWidth = columns.reduce((total, column) => total + column.width, 0);

      const drawHeader = (): void => {
        let x = startX;
        doc.rect(startX, y, tableWidth, 22).fill(PRIMARY);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
        for (const column of columns) {
          doc.text(column.label, x + 3, y + 7, { width: column.width - 6, align: 'center' });
          x += column.width;
        }
        y += 22;
      };

      drawHeader();

      doc.font('Helvetica').fontSize(8).fillColor(TEXT);
      data.recap.forEach((item, index) => {
        if (y > 720) {
          doc.addPage();
          y = 40;
          drawHeader();
          doc.font('Helvetica').fontSize(8).fillColor(TEXT);
        }

        const values = [
          String(index + 1),
          item.name,
          item.nim ?? '-',
          String(item.hadir),
          String(item.terlambat),
          String(item.izin),
          String(item.sakit),
          String(item.alpha),
          String(item.libur),
          `${item.persentaseKehadiran}%`,
        ];

        if (index % 2 === 1) {
          doc.rect(startX, y, tableWidth, 18).fill('#F3F6FA');
          doc.fillColor(TEXT);
        }

        let x = startX;
        values.forEach((value, columnIndex) => {
          doc.text(value, x + 3, y + 5, {
            width: columns[columnIndex].width - 6,
            align: columnIndex === 1 ? 'left' : 'center',
            ellipsis: true,
          });
          x += columns[columnIndex].width;
        });
        y += 18;
      });

      doc.moveTo(startX, y).lineTo(startX + tableWidth, y).strokeColor('#D1D5DB').stroke();
      y += 16;

      if (y > 680) {
        doc.addPage();
        y = 40;
      }

      doc.fillColor(MUTED).font('Helvetica').fontSize(8);
      doc.text(
        'Catatan: persentase kehadiran dihitung dari (Hadir + Terlambat) dibagi total hari kerja pada periode.',
        startX,
        y,
        { width: tableWidth },
      );

      // Blok tanda tangan
      const signatureY = Math.max(y + 40, 700);
      doc.fillColor(TEXT).fontSize(9);
      doc.text(
        `Padang Lawas, ${new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(data.generatedAt)}`,
        350,
        signatureY,
      );
      doc.text('Kepala Badan Pusat Statistik', 350, signatureY + 16);
      doc.text('Kabupaten Padang Lawas', 350, signatureY + 30);
      doc.moveDown(3.5);
      doc.font('Helvetica-Bold').text('......................................', 350, signatureY + 78);

      doc.end();
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Gagal membuat laporan PDF.'));
    }
  });
}
