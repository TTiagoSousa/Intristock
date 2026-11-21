export interface JwtUserPayload {
  id: string;
  email: string;
  fullName: string;
  /** «Lembrar-me» no login: o cookie dura 7 dias */
  remember?: boolean;
}
