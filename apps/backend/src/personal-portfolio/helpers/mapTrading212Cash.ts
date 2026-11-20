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

// Os tipos que são ganho ou custo (não dinheiro que a pessoa mete ou tira)
const RESULT_KINDS = ['fee', 'interest'];

/**
 * Um movimento de dinheiro como transação: o tipo e o valor positivo (o tipo diz o lado).
 * Uma comissão ou um juro com o sinal ao contrário (uma comissão devolvida, um juro
 * estornado) fica com o tipo e o valor negativo, para continuar a ser ganho ou custo;
 * um depósito ou levantamento ao contrário (ou um TRANSFER) entra como o outro. Os de 0
 * não entram.
 */
export function mapTrading212Cash(movement: Trading212CashMovement) {
  const amount = Math.round(movement.amount * 100) / 100;
  if (!amount) return null;
  const kind = KIND_BY_TYPE[movement.type];
  if (kind && RESULT_KINDS.includes(kind)) return { kind, amount: amount * SIGN_BY_KIND[kind] };
  if (!kind || Math.sign(amount) !== SIGN_BY_KIND[kind])
    return { kind: amount > 0 ? 'deposit' : 'withdrawal', amount: Math.abs(amount) };
  return { kind, amount: Math.abs(amount) };
}
