import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RetentionRepository } from '../retention-repository';

@Injectable()
export class PrismaRetentionRepository implements RetentionRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Aos blocos (um DELETE com LIMIT por baixo): a primeira limpeza pode ter milhões de linhas
  async deleteReadNotifications(before: Date, limit: number): Promise<number> {
    return this.prisma.$executeRaw`
      DELETE FROM "Notification"
      WHERE id IN (
        SELECT id FROM "Notification"
        WHERE "readAt" IS NOT NULL
          AND "createdAt" < ${before}
          AND ("actionStatus" IS NULL OR "actionStatus" <> 'pending')
        LIMIT ${limit}
      )`;
  }

  async deleteLiveTestEvents(kinds: string[], statuses: string[], before: Date, limit: number): Promise<number> {
    return this.prisma.$executeRaw`
      DELETE FROM "LiveTestEvent"
      WHERE id IN (
        SELECT e.id FROM "LiveTestEvent" e
        JOIN "LiveTest" t ON t.id = e."testId"
        WHERE e.kind = ANY(${kinds})
          AND e."time" < ${before}
          AND t.status = ANY(${statuses})
        LIMIT ${limit}
      )`;
  }
}
