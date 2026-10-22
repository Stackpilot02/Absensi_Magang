import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveRequest, LeaveStatus, Role } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateLeaveDto, ReviewLeaveDto } from './dto/leave.dto';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class LeavesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(requester: AuthUser, dto: CreateLeaveDto): Promise<LeaveRequest> {
    const startDate = new Date(`${dto.startDate.slice(0, 10)}T00:00:00.000Z`);
    const endDate = new Date(`${dto.endDate.slice(0, 10)}T00:00:00.000Z`);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Tanggal pengajuan tidak valid.');
    }
    if (endDate < startDate) {
      throw new BadRequestException('Tanggal selesai tidak boleh sebelum tanggal mulai.');
    }

    return this.prisma.leaveRequest.create({
      data: {
        userId: requester.id,
        type: dto.type,
        startDate,
        endDate,
        reason: dto.reason,
      },
    });
  }

  async findAll(
    requester: AuthUser,
    status?: LeaveStatus,
  ): Promise<LeaveRequest[]> {
    let userIds: string[] | null = null;

    if (requester.role === Role.MAGANG) {
      userIds = [requester.id];
    } else if (requester.role === Role.PEMBIMBING) {
      const mentees = await this.prisma.user.findMany({
        where: { mentorId: requester.id },
        select: { id: true },
      });
      userIds = [requester.id, ...mentees.map((m) => m.id)];
    }

    return this.prisma.leaveRequest.findMany({
      where: {
        ...(userIds ? { userId: { in: userIds } } : {}),
        ...(status ? { status } : {}),
      },
      include: { user: { select: { id: true, name: true, nim: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async review(
    id: string,
    reviewer: AuthUser,
    dto: ReviewLeaveDto,
  ): Promise<LeaveRequest> {
    if (dto.status === LeaveStatus.PENDING) {
      throw new BadRequestException('Status peninjauan hanya boleh APPROVED atau REJECTED.');
    }

    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) {
      throw new NotFoundException('Pengajuan tidak ditemukan.');
    }

    if (reviewer.role === Role.PEMBIMBING) {
      const mentee = await this.prisma.user.findFirst({
        where: { id: leave.userId, mentorId: reviewer.id },
      });
      if (!mentee) {
        throw new ForbiddenException('Anda tidak membimbing pengaju tersebut.');
      }
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: dto.status,
        reviewNote: dto.reviewNote,
        reviewerId: reviewer.id,
        reviewedAt: new Date(),
      },
    });
  }
}
