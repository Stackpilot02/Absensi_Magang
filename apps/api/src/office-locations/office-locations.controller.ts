import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OfficeLocation, Role } from '@prisma/client';
import { OfficeLocationsService } from './office-locations.service';
import {
  CreateOfficeLocationDto,
  UpdateOfficeLocationDto,
} from './dto/office-location.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('office-locations')
export class OfficeLocationsController {
  constructor(private readonly service: OfficeLocationsService) {}

  @Get()
  findAll(): Promise<OfficeLocation[]> {
    return this.service.findAll();
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateOfficeLocationDto): Promise<OfficeLocation> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOfficeLocationDto,
  ): Promise<OfficeLocation> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string): Promise<{ message: string }> {
    return this.service.deactivate(id);
  }
}
