import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { JwtAuthGuard } from 'src/auth-employee/guards/jwt-auth.guard';
import { AdminGuard } from 'src/auth-employee/guards/admin.guard';
import { JwtPayload } from 'src/auth-employee/jwt-payload.interface';

@Controller('employee')
@UseGuards(JwtAuthGuard)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  // Criar contas de funcionário é o que dá acesso ao backoffice — só Admin
  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeeService.create(dto);
  }

  @Get('me')
  findCurrent(@Req() req: Request & { user: JwtPayload }) {
    return this.employeeService.findCurrent(req.user.id);
  }

  @Get()
  findAll() {
    return this.employeeService.findAll();
  }
}
