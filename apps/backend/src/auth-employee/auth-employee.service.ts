import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaEmployeeRepository } from 'src/employee/repositories/prisma/prisma-employee-repository';
import { validateEmployee } from './helpers/validateEmployee';
import { loginEmployee } from './helpers/loginEmployee';

@Injectable()
export class AuthEmployeeService {
  constructor(
    private readonly employeeRepository: PrismaEmployeeRepository,
    private readonly jwt: JwtService,
  ) {}

  async validateEmployee(email: string, password: string) {
    return validateEmployee(email, password, this.employeeRepository);
  }

  async login(employee: { id: string; email: string; jobTypeId: string }) {
    return loginEmployee(employee, this.jwt);
  }
}
