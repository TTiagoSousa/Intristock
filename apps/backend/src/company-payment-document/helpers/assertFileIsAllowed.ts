import { BadRequestException } from '@nestjs/common';

// 15 MB. Uma fatura em PDF anda nos KB; passar muito disto é sinal de engano.
export const MAX_FILE_SIZE = 15 * 1024 * 1024;

/**
 * Tipos aceites, identificados pelos primeiros bytes do ficheiro.
 *
 * O `mimetype` que vem no upload é escrito pelo cliente e mente com toda a
 * facilidade — basta renomear um .exe para .pdf. Só os bytes é que dizem a
 * verdade sobre o que o ficheiro é.
 */
const SIGNATURES: { mime: string; bytes: number[]; offset?: number }[] = [
  // %PDF
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  // WEBP: "RIFF" nos primeiros 4 bytes e "WEBP" a partir do 8
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

const startsWith = (buffer: Buffer, bytes: number[], offset = 0) =>
  bytes.every((byte, index) => buffer[offset + index] === byte);

/**
 * Devolve o mime type real do ficheiro, ou rebenta se não for um dos aceites.
 * O tipo devolvido é o que fica gravado — nunca o que o cliente disse.
 */
export function assertFileIsAllowed(file: { buffer: Buffer; size: number; originalname: string }) {
  if (!file.buffer || file.size === 0) {
    throw new BadRequestException('O ficheiro está vazio');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestException(
      `O ficheiro é demasiado grande (máximo ${MAX_FILE_SIZE / 1024 / 1024} MB)`,
    );
  }

  for (const signature of SIGNATURES) {
    if (!startsWith(file.buffer, signature.bytes, signature.offset)) continue;

    // O RIFF também é usado por áudio e vídeo — confirma-se que é mesmo WEBP
    if (signature.mime === 'image/webp' && !startsWith(file.buffer, [0x57, 0x45, 0x42, 0x50], 8)) {
      continue;
    }

    return signature.mime;
  }

  throw new BadRequestException('Só são aceites ficheiros PDF, PNG, JPG ou WEBP');
}

/**
 * O nome original só serve para mostrar e para o download. Tira-se-lhe tudo o
 * que possa fazer estragos: caminhos, quebras de linha e aspas — que seriam
 * interpretadas no cabeçalho Content-Disposition.
 */
export function sanitizeFileName(originalName: string) {
  const withoutPath = originalName.split(/[\\/]/).pop() ?? 'documento';
  const cleaned = withoutPath.replace(/[\r\n"]/g, '').trim();

  return cleaned.slice(0, 255) || 'documento';
}
