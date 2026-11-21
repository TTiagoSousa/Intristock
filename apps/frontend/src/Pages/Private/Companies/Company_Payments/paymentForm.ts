// O que o formulário de um pagamento usa fora do componente: as linhas em edição e as contas

// Linha em edição: os valores ficam string enquanto se escreve e só são
// convertidos no submit
export interface Draft_Line {
  // Chave estável da linha — o itemId não serve, pode estar vazio ou repetido
  key: string;
  itemId: string;
  quantity: string;
  unitPrice: string;
}

// KB até 1 MB, depois MB — números com sete dígitos não dizem nada a ninguém
export const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// Contador em vez de crypto.randomUUID: esse só existe em https ou localhost,
// e a VM abre-se em http pelo IP
let lineSeq = 0;

export const emptyLine = (): Draft_Line => ({
  key: `line-${++lineSeq}`,
  itemId: '',
  quantity: '1',
  unitPrice: '',
});

// Dinheiro com 2 casas: quantidade × preço em floats deixa restos
export const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const lineTotal = (line: Draft_Line) => {
  const quantity = Number(line.quantity);
  const unitPrice = Number(line.unitPrice);

  if (Number.isNaN(quantity) || Number.isNaN(unitPrice)) return 0;

  return roundMoney(quantity * unitPrice);
};
