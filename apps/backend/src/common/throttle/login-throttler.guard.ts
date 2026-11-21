import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerRequest } from '@nestjs/throttler';
import { LOGIN_IP_LIMIT, LOGIN_LIMIT } from './throttle.constants';

// O limite do login: LOGIN_LIMIT por IP e conta e LOGIN_IP_LIMIT por IP. Corre antes
// do guard local (o do bcrypt), por isso um flood não gasta CPU.
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(props: ThrottlerRequest): Promise<boolean> {
    const ip = (req: Record<string, any>) => this.getTracker(req);
    const login = (req: Record<string, any>) =>
      String(req.body?.email ?? '').trim().toLowerCase().slice(0, 200);

    await super.handleRequest({
      ...props,
      ...LOGIN_LIMIT,
      blockDuration: LOGIN_LIMIT.ttl,
      throttler: { ...props.throttler, name: 'login' },
      getTracker: async (req) => `${await ip(req)}|${login(req)}`,
    });

    return super.handleRequest({
      ...props,
      ...LOGIN_IP_LIMIT,
      blockDuration: LOGIN_IP_LIMIT.ttl,
      throttler: { ...props.throttler, name: 'login-ip' },
      getTracker: ip,
    });
  }
}
