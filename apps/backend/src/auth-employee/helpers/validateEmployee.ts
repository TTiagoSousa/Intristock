import { PrismaEmployeeRepository } from 'src/employee/repositories/prisma/prisma-employee-repository';
import * as bcrypt from 'bcrypt';

export async function validateEmployee(
  email: string,
  password: string,
  employeeRepository: PrismaEmployeeRepository,
) {
  const employee = await employeeRepository.findByEmail(email);
  if (!employee) return null;

  const valid = await bcrypt.compare(password, employee.hashedPassword);
  if (!valid) return null;

  const { hashedPassword: _, ...result } = employee;
  return result;
}
