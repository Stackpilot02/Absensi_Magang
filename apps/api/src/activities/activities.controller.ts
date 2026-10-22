import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ActivitiesService } from './activities.service';
import {
  CreateActivityDto,
  ListActivitiesQueryDto,
  UpdateActivityDto,
} from './dto/activity.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  @Roles(Role.MAGANG)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateActivityDto) {
    return this.activitiesService.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListActivitiesQueryDto) {
    return this.activitiesService.findAll(user, query);
  }

  @Patch(':id')
  @Roles(Role.MAGANG)
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activitiesService.update(id, user, dto);
  }

  @Delete(':id')
  @Roles(Role.MAGANG)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.activitiesService.remove(id, user);
  }
}
