/// ADMIN gere a instalação: utilizadores, APIs externas, versões e catálogo.
/// USER usa a app. Strings e não enum do Prisma, como os outros estados do schema.
export const USER_ROLES = ['ADMIN', 'USER'] as const;
export type UserRole = (typeof USER_ROLES)[number];
