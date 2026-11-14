import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmployeeRepository } from '../employee-repository';
import { Employee } from 'src/generated/prisma/client/client';

@Injectable()
export class PrismaEmployeeRepository implements EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<Employee | null> {
    return this.prisma.employee.findUnique({ where: { email } });
  }

  async findByEmployeeNumber(employeeNumber: string): Promise<Employee | null> {
    return this.prisma.employee.findUnique({ where: { employeeNumber } });
  }

  async create(data: {
    employeeNumber: string;
    email: string;
    fullName: string;
    firstName: string;
    lastName: string;
    hashedPassword: string;
    jobTypeId: string;
  }): Promise<Employee> {
    return this.prisma.employee.create({ data });
  }

  async findById(id: string): Promise<Omit<Employee, 'hashedPassword'> | null> {
    return this.prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        employeeNumber: true,
        email: true,
        fullName: true,
        firstName: true,
        lastName: true,
        countryId: true,
        jobTypeId: true,
        jobType: true,
        createdAt: true,
        updatedAt: true,
      },
    }) as Promise<Omit<Employee, 'hashedPassword'> | null>;
  }

  async findAll(): Promise<Omit<Employee, 'hashedPassword'>[]> {
    return this.prisma.employee.findMany({
      select: {
        id: true,
        employeeNumber: true,
        email: true,
        fullName: true,
        firstName: true,
        lastName: true,
        countryId: true,
        jobTypeId: true,
        jobType: true,
        createdAt: true,
        updatedAt: true,
      },
    }) as Promise<Omit<Employee, 'hashedPassword'>[]>;
  }
}
