// O `?next=` do login: só caminhos desta app (começam por uma barra e não por
// duas, nem por uma barra invertida), para o login não levar a outro site.
export const safeNextPath = (value: string | null | undefined, fallback = '/Dashboard') => {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (value === '/Auth' || value.startsWith('/Auth?') || value === '/') return fallback;
  try {
    // Confirma que fica na mesma origem (o browser ignora tabs e quebras de linha no URL)
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
};
