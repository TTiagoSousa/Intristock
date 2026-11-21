import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Público (sem guard): o update.sh chama-o em 127.0.0.1 depois de reiniciar. */
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
