import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtUserPayload } from '../jwt-payload.interface';

/**
 * Só deixa passar um user com papel ADMIN. Usa-se sempre depois do
 * JwtUserAuthGuard, que é quem põe o `req.user`.
 *
 * O papel é lido da base de dados a cada pedido, e não do token: tirar o papel
 * a alguém tem efeito imediato, sem esperar que a sessão dele expire.
 */
@Injectable()
export class UserAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: JwtUserPayload }>();
    const userId = request.user?.id;

    const user = userId
      ? await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, active: true } })
      : null;

    if (!user || !user.active || user.role !== 'ADMIN') {
      throw new ForbiddenException('Só um administrador pode fazer isto');
    }

    return true;
  }
}
