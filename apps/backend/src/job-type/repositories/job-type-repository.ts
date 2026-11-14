import { JobType } from 'src/generated/prisma/client/client';

export interface JobTypeRepository {
  create(name: string): Promise<JobType>;
  findAll(): Promise<JobType[]>;
  findByName(name: string): Promise<JobType | null>;
  findById(id: string): Promise<JobType | null>;
}
