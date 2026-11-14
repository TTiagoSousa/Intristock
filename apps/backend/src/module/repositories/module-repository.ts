import { Module as SystemModule } from 'src/generated/prisma/client/client';

export interface ModuleRepository {
  create(data: {
    name: string;
    label: string;
    description?: string;
    icon?: string;
    isActive?: boolean;
  }): Promise<SystemModule>;
  update(
    id: string,
    data: {
      name?: string;
      label?: string;
      description?: string;
      icon?: string;
      isActive?: boolean;
    },
  ): Promise<SystemModule>;
  findById(id: string): Promise<SystemModule | null>;
  findByName(name: string): Promise<SystemModule | null>;
  findAll(): Promise<SystemModule[]>;
  findAllActive(): Promise<SystemModule[]>;
}
