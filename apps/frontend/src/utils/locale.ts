// O locale do Intl para a língua da app: 'pt' sozinho o Intl lê como pt-BR
export const localeOf = (language: string) => (language === 'pt' ? 'pt-PT' : 'en-GB');
