import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PrismaNotificationRepository } from './repositories/prisma/prisma-notification-repository';

// Os avisos de cada utilizador; os outros módulos criam-nos pelo NotificationService
@Module({
  controllers: [NotificationController],
  providers: [
    NotificationService,
    {
      provide: PrismaNotificationRepository,
      useClass: PrismaNotificationRepository,
    },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
