import { PrismaEmployeeRepository } from '../repositories/prisma/prisma-employee-repository';

export async function findAllEmployees(employeeRepository: PrismaEmployeeRepository) {
  return employeeRepository.findAll();
}
