import * as bcrypt from 'bcrypt';

// Um hash com o mesmo custo (12) das passwords guardadas, de uma password que
// ninguém usa. Quando a conta não existe compara-se com ele, para o login demorar
// o mesmo e o tempo não denunciar que contas há.
export const DUMMY_PASSWORD_HASH = '$2b$12$TkWwNJpW8i/.DYk2zj2hf.PbL07WXmeXgzPn2hnTXz6tdnIgKs9FS';

export async function comparePasswords(args: { password: string; hash: string }) {
  return await bcrypt.compare(args.password, args.hash);
}
