import { JwtService } from '@nestjs/jwt';

export function loginEmployee(
  employee: { id: string; email: string; jobTypeId: string },
  jwtService: JwtService,
) {
  const payload = { sub: employee.id, email: employee.email, jobTypeId: employee.jobTypeId };
  return jwtService.sign(payload);
}
