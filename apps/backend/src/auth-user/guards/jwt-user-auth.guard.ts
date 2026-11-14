import { AuthGuard } from '@nestjs/passport';

export class JwtUserAuthGuard extends AuthGuard('jwt-user') {}
