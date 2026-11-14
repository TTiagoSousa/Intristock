import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SystemRepository } from '../system-repository';

@Injectable()
export class PrismaSystemRepository implements SystemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async readSetting(key: string) {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  async writeSetting(key: string, value: string) {
    await this.prisma.appSetting.upsert({
      where: { key },
      update: { value, encrypted: false },
      create: { key, value, encrypted: false },
    });
  }
}
