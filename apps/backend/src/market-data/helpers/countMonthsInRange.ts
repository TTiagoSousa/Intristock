// Quantos meses de calendário (UTC) toca o intervalo [from, to[. É ao mês que
// o downloader descarrega, por isso é esta a unidade do progresso
export function countMonthsInRange(from: Date, to: Date) {
  const last = new Date(to.getTime() - 1);
  return (
    (last.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (last.getUTCMonth() - from.getUTCMonth()) +
    1
  );
}
