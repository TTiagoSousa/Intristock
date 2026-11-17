import { Trading212CashMovement } from './trading212Client';

// O tipo da Trading 212 → o do dinheiro passivo. Os câmbios entre as carteiras de
// moeda vêm como três linhas à mesma hora (sai numa moeda, entra noutra e a comissão)
// e entram assim mesmo: o original fica no `externalType`.
const KIND_BY_TYPE: Record<string, string> = {
  DEPOSIT: 'deposit',
  WITHDRAW: 'withdrawal',
  FEE: 'fee',
  INTEREST_ON_FREE_CASH: 'interest',
  LENDING_INTEREST: 'interest',
};

// O lado para que cada tipo conta no saldo
const SIGN_BY_KIND: Record<string, number> = { deposit: 1, interest: 1, withdrawal: -1, fee: -1 };

/**
 * Um movimento de dinheiro como transação: o tipo e o valor sempre positivo (o tipo
 * diz o lado). Um valor com o sinal ao contrário do tipo (ou um TRANSFER) entra como
 * depósito ou levantamento; os de 0 não entram.
 */
export function mapTrading212Cash(movement: Trading212CashMovement) {
  const amount = Math.round(movement.amount * 100) / 100;
  if (!amount) return null;
  let kind = KIND_BY_TYPE[movement.type];
  if (!kind || Math.sign(amount) !== SIGN_BY_KIND[kind]) kind = amount > 0 ? 'deposit' : 'withdrawal';
  return { kind, amount: Math.abs(amount) };
}
