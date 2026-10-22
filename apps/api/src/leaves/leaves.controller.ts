import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { LeaveRequest, LeaveStatus, Role } from '@prisma/client';
import { LeavesService } from './leaves.service';
import { CreateLeaveDto, ReviewLeaveDto } from './dto/leave.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('leaves')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeaveDto): Promise<LeaveRequest> {
    return this.leavesService.create(user, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: LeaveStatus,
  ): Promise<LeaveRequest[]> {
    return this.leavesService.findAll(user, status);
  }

  @Patch(':id/review')
  @Roles(Role.ADMIN, Role.PEMBIMBING)
  review(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReviewLeaveDto,
  ): Promise<LeaveRequest> {
    return this.leavesService.review(id, user, dto);
  }
}
