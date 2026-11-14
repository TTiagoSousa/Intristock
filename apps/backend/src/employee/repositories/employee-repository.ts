import { Employee } from 'src/generated/prisma/client/client';

export interface EmployeeRepository {
  findByEmail(email: string): Promise<Employee | null>;
  findByEmployeeNumber(employeeNumber: string): Promise<Employee | null>;
  findById(id: string): Promise<Omit<Employee, 'hashedPassword'> | null>;
  create(data: {
    employeeNumber: string;
    email: string;
    fullName: string;
    firstName: string;
    lastName: string;
    hashedPassword: string;
    jobTypeId: string;
  }): Promise<Employee>;
  findAll(): Promise<Omit<Employee, 'hashedPassword'>[]>;
}
