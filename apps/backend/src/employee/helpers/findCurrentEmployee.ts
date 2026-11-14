import { NotFoundException } from '@nestjs/common';
import { EmployeeRepository } from '../repositories/employee-repository';

export async function findCurrentEmployee(id: string, repository: EmployeeRepository) {
  const employee = await repository.findById(id);
  if (!employee) throw new NotFoundException('Employee not found');
  return employee;
}
