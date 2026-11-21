import { applyDecorators, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserThrottlerGuard } from './user-throttler.guard';

// Limita uma rota por utilizador: `limit` pedidos a cada `ttl` ms. Numa rota com o
// JwtUserAuthGuard no controller (os guards do controller correm antes dos da rota)
export function UserThrottle(options: { limit: number; ttl: number }) {
  return applyDecorators(
    Throttle({ default: options }),
    UseGuards(UserThrottlerGuard),
  );
}
