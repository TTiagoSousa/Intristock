import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  /**
   * O health check do update.sh: o processo responde e chega à base de dados.
   * Sem base de dados é 503, para a atualização voltar atrás.
   */
  async getHealth(): Promise<{ status: 'ok'; database: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unreachable',
      });
    }
    return { status: 'ok', database: 'ok' };
  }
}
