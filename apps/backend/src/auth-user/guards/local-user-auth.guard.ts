import { AuthGuard } from '@nestjs/passport';

export class LocalUserAuthGuard extends AuthGuard('local-user') {}
