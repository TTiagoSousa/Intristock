import { BadRequestException } from '@nestjs/common';
import {
  fetchSolidtimeMemberships,
  fetchSolidtimeUser,
  SolidtimeCredentials,
  SolidtimeError,
  SOLIDTIME_UNREACHABLE,
} from './solidtimeClient';

/**
 * Valida a chave no solidtime (`users/me`) e devolve o utilizador dela e as organizações a
 * que tem acesso. Uma chave recusada ou um endereço sem solidtime é um 400 (o endereço, sempre com
 * a mesma mensagem: não se distingue um host que não responde de um que não é um solidtime).
 */
export async function checkSolidtimeToken(credentials: SolidtimeCredentials) {
  try {
    const user = await fetchSolidtimeUser(credentials);
    const memberships = await fetchSolidtimeMemberships(credentials);
    return {
      user: { id: user.id, name: user.name },
      organizations: memberships.map((membership) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        currency: membership.organization.currency,
        role: membership.role,
      })),
    };
  } catch (error) {
    if (error instanceof SolidtimeError) throw new BadRequestException(error.message);
    throw new BadRequestException(SOLIDTIME_UNREACHABLE);
  }
}
