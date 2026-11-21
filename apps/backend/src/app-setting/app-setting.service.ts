import { Injectable } from '@nestjs/common';
import { PrismaAppSettingRepository } from './repositories/prisma/prisma-app-setting-repository';
import { getApiConfig } from './helpers/getApiConfig';
import { getApiSettings } from './helpers/getApiSettings';
import { saveApiSettings } from './helpers/saveApiSettings';
import { getSetupStatus } from './helpers/getSetupStatus';
import { getApisHealth } from './helpers/checkApiHealth';
import { ApiKind } from './helpers/apiProviders';
import { SaveApiSettingsDto } from './dto/save-api-settings.dto';
import { findJobLastRun } from './helpers/findJobLastRun';
import { saveJobLastRun } from './helpers/saveJobLastRun';

@Injectable()
export class AppSettingService {
  constructor(private readonly settingRepository: PrismaAppSettingRepository) {}

  /** Usado pelos módulos de moedas e países para chamar as APIs externas. */
  apiConfig(kind: ApiKind) {
    return getApiConfig(kind, this.settingRepository);
  }

  apiSettings() {
    return getApiSettings(this.settingRepository);
  }

  saveApiSettings(dto: SaveApiSettingsDto) {
    return saveApiSettings(dto, this.settingRepository);
  }

  apisHealth() {
    return getApisHealth(this.settingRepository);
  }

  status() {
    return getSetupStatus(this.settingRepository);
  }

  /** Quando correu pela última vez uma tarefa agendada (`startScheduledJob`). */
  jobLastRunAt(job: string) {
    return findJobLastRun(job, this.settingRepository);
  }

  markJobRun(job: string, at = new Date()) {
    return saveJobLastRun(job, at, this.settingRepository);
  }
}
