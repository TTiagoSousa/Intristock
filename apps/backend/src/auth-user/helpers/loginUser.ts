import { JwtService } from '@nestjs/jwt';

// `remember` vai no token para, ao emiti-lo outra vez (mudar a password), o cookie
// manter a duração que a pessoa escolheu no login
export function loginUser(
  user: { id: string; email: string; fullName: string },
  jwtService: JwtService,
  remember = false,
) {
  const payload = { sub: user.id, email: user.email, fullName: user.fullName, remember };
  return jwtService.sign(payload);
}
