import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JobTypeService } from './job-type.service';
import { CreateJobTypeDto } from './dto/create-job-type.dto';
import { JwtAuthGuard } from 'src/auth-employee/guards/jwt-auth.guard';
import { AdminGuard } from 'src/auth-employee/guards/admin.guard';

@Controller('job-type')
@UseGuards(JwtAuthGuard)
export class JobTypeController {
  constructor(private readonly jobTypeService: JobTypeService) {}

  // Um cargo novo chamado "Admin" seria um Admin novo — só Admin cria cargos
  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateJobTypeDto) {
    return this.jobTypeService.create(dto);
  }

  @Get()
  findAll() {
    return this.jobTypeService.findAll();
  }
}
