import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Conta os pedidos por utilizador (o JwtUserAuthGuard tem de correr antes); sem
// sessão, pelo IP
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id;
    return userId ? `user:${userId}` : super.getTracker(req);
  }
}
