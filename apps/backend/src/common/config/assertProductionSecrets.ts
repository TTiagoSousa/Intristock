// Os segredos que o backend usa e os valores de exemplo do .env.example, que nunca
// podem chegar a produção
const REQUIRED_SECRETS = ['JWT_USER_SECRET', 'ENCRYPTION_KEY'] as const;
const EXAMPLE_VALUES = new Set(['troca-isto', 'troca-isto-tambem', 'changeme', 'secret']);
const MIN_LENGTH = 32;

/**
 * Em produção (NODE_ENV=production, o da VM) recusa arrancar com um segredo em
 * falta, com menos de 32 caracteres ou igual a um do exemplo. O instalador gera-os
 * com 44 ou mais. Em desenvolvimento não verifica.
 */
export function assertProductionSecrets(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV !== 'production') return;

  const weak = REQUIRED_SECRETS.filter((name) => {
    const value = (env[name] ?? '').trim();
    return value.length < MIN_LENGTH || EXAMPLE_VALUES.has(value.toLowerCase());
  });

  if (weak.length) {
    throw new Error(
      `Segredos fracos ou de exemplo em produção: ${weak.join(', ')}. ` +
        `Cada um precisa de pelo menos ${MIN_LENGTH} caracteres aleatórios ` +
        '(por exemplo `openssl rand -base64 48`). A ENCRYPTION_KEY não se muda depois de haver chaves guardadas.',
    );
  }
}
