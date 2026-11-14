import { ConflictException } from '@nestjs/common';
import { PrismaEmployeeRepository } from '../repositories/prisma/prisma-employee-repository';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import * as bcrypt from 'bcrypt';

export async function createEmployee(
  dto: CreateEmployeeDto,
  employeeRepository: PrismaEmployeeRepository,
) {
  const emailExists = await employeeRepository.findByEmail(dto.email);
  if (emailExists) throw new ConflictException('Email já existe');

  const numberExists = await employeeRepository.findByEmployeeNumber(dto.employeeNumber);
  if (numberExists) throw new ConflictException('Número de empregado já existe');

  const { password, fullName, ...rest } = dto;
  const hashedPassword = await bcrypt.hash(password, 12);

  const spaceIndex = fullName.indexOf(' ');
  const firstName = spaceIndex > 0 ? fullName.slice(0, spaceIndex) : fullName;
  const lastName = spaceIndex > 0 ? fullName.slice(spaceIndex + 1).trim() : '';

  const { hashedPassword: _, ...employee } = await employeeRepository.create({
    ...rest,
    fullName,
    firstName,
    lastName,
    hashedPassword,
  });
  return employee;
}
