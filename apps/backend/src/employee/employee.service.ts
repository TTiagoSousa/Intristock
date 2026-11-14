import { Injectable } from '@nestjs/common';
import { PrismaEmployeeRepository } from './repositories/prisma/prisma-employee-repository';
import { createEmployee } from './helpers/createEmployee';
import { findAllEmployees } from './helpers/findAllEmployees';
import { findCurrentEmployee } from './helpers/findCurrentEmployee';
import { CreateEmployeeDto } from './dto/create-employee.dto';

@Injectable()
export class EmployeeService {
  constructor(private readonly employeeRepository: PrismaEmployeeRepository) {}

  async create(dto: CreateEmployeeDto) {
    return createEmployee(dto, this.employeeRepository);
  }

  async findAll() {
    return findAllEmployees(this.employeeRepository);
  }

  async findCurrent(id: string) {
    return findCurrentEmployee(id, this.employeeRepository);
  }
}
