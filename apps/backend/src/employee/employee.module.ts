import { Module } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { PrismaEmployeeRepository } from './repositories/prisma/prisma-employee-repository';
import { JobTypeModule } from 'src/job-type/job-type.module';

@Module({
  // O AdminGuard injeta o PrismaJobTypeRepository
  imports: [JobTypeModule],
  controllers: [EmployeeController],
  providers: [
    EmployeeService,
    {
      provide: PrismaEmployeeRepository,
      useClass: PrismaEmployeeRepository,
    },
  ],
  exports: [PrismaEmployeeRepository],
})
export class EmployeeModule {}
