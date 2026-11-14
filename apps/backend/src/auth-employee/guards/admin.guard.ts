import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaJobTypeRepository } from 'src/job-type/repositories/prisma/prisma-job-type-repository';
import { JwtPayload } from '../jwt-payload.interface';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jobTypeRepository: PrismaJobTypeRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();

    const jobType = await this.jobTypeRepository.findById(request.user.jobTypeId);

    if (!jobType || jobType.name !== 'Admin') {
      throw new ForbiddenException('Only admins can perform this action');
    }

    return true;
  }
}
