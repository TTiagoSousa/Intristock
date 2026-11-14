// O que o sistema guarda de uma vez para a outra: a última versão vista e a última
// anunciada (no AppSetting, sem cifra)
export interface SystemRepository {
  readSetting(key: string): Promise<string | null>;
  writeSetting(key: string, value: string): Promise<void>;
}
