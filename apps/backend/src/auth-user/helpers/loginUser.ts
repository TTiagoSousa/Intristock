import { JwtService } from '@nestjs/jwt';

export function loginUser(
  user: { id: string; email: string; fullName: string },
  jwtService: JwtService,
) {
  const payload = { sub: user.id, email: user.email, fullName: user.fullName };
  return jwtService.sign(payload);
}
