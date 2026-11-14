import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { FindNotificationsQueryDto } from './dto/find-notifications-query.dto';
import { NotificationService } from './notification.service';

// Os avisos do utilizador (o sino no topo)
@Controller('notifications')
@UseGuards(JwtUserAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findAll(
    @Req() req: Request & { user: JwtUserPayload },
    @Query() query: FindNotificationsQueryDto,
  ) {
    return this.notificationService.findAll(req.user.id, query);
  }

  @Post('read-all')
  @HttpCode(200)
  markAllRead(@Req() req: Request & { user: JwtUserPayload }) {
    return this.notificationService.markAllRead(req.user.id);
  }

  @Post(':id/read')
  @HttpCode(200)
  markRead(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationService.markRead(req.user.id, id);
  }
}
