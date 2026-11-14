import { Module } from '@nestjs/common';
import { JobTypeService } from './job-type.service';
import { JobTypeController } from './job-type.controller';
import { PrismaJobTypeRepository } from './repositories/prisma/prisma-job-type-repository';

@Module({
  controllers: [JobTypeController],
  providers: [
    JobTypeService,
    {
      provide: PrismaJobTypeRepository,
      useClass: PrismaJobTypeRepository,
    },
  ],
  exports: [PrismaJobTypeRepository],
})
export class JobTypeModule {}
