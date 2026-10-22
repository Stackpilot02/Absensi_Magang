import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListLeavesQueryDto, ReviewLeaveDto } from './dto/leave.dto';

/**
 * Validasi ini menjaga agar nilai status yang tidak dikenal dibalas 400
 * (bukan 500 dari Prisma seperti sebelum perbaikan).
 */
describe('DTO pengajuan izin', () => {
  it('menerima status query yang valid', async () => {
    for (const status of ['PENDING', 'APPROVED', 'REJECTED']) {
      const dto = plainToInstance(ListLeavesQueryDto, { status });
      await expect(validate(dto)).resolves.toHaveLength(0);
    }
  });

  it('menerima query tanpa filter status', async () => {
    const dto = plainToInstance(ListLeavesQueryDto, {});
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('menolak status query yang tidak dikenal', async () => {
    const dto = plainToInstance(ListLeavesQueryDto, { status: 'MENUNGGU' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('status');
    expect(errors[0].constraints?.isEnum).toContain('PENDING');
  });

  it('menolak status query kosong', async () => {
    const dto = plainToInstance(ListLeavesQueryDto, { status: '' });
    await expect(validate(dto)).resolves.toHaveLength(1);
  });

  it('DTO review menerima enum valid; aturan larangan PENDING ada di service', async () => {
    const valid = await validate(plainToInstance(ReviewLeaveDto, { status: 'APPROVED' }));
    const pending = await validate(plainToInstance(ReviewLeaveDto, { status: 'PENDING' }));

    expect(valid).toHaveLength(0);
    expect(pending).toHaveLength(0);
  });
});
