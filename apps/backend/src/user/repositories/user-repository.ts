import { User } from 'src/generated/prisma/client/client';

export type UserUpdate = Partial<
  Pick<
    User,
    | 'firstName'
    | 'lastName'
    | 'fullName'
    | 'email'
    | 'hashedPassword'
    | 'role'
    | 'active'
    | 'blockedUntil'
    | 'blockedReason'
  >
>;

/// O que impede apagar uma conta: dados partilhados que criou e o que ainda corre
export interface UserOwnedData {
  companies: number;
  bankAccounts: number;
  running: number;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<Omit<User, 'hashedPassword'> | null>;
  findPasswordHash(id: string): Promise<string | null>;
  create(data: {
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    hashedPassword: string;
    role: string;
    active: boolean;
  }): Promise<User>;
  findAll(): Promise<Omit<User, 'hashedPassword'>[]>;
  updatePassword(id: string, hashedPassword: string): Promise<User>;
  update(id: string, data: UserUpdate): Promise<Omit<User, 'hashedPassword'>>;
  delete(id: string): Promise<void>;
  countUsableAdmins(exceptId: string): Promise<number>;
  countOwnedData(id: string): Promise<UserOwnedData>;
}
