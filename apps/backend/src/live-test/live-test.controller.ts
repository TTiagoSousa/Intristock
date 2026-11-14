import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { CreateLiveTestDto } from './dto/create-live-test.dto';
import { FindLiveEventsQueryDto } from './dto/find-live-events-query.dto';
import { FindLiveTestsQueryDto } from './dto/find-live-tests-query.dto';
import { LiveTestService } from './live-test.service';

@Controller('live-tests')
@UseGuards(JwtUserAuthGuard)
export class LiveTestController {
  constructor(private readonly liveTestService: LiveTestService) {}

  @Post()
  create(
    @Req() req: Request & { user: JwtUserPayload },
    @Body() dto: CreateLiveTestDto,
  ) {
    return this.liveTestService.create(req.user.id, dto);
  }

  @Get()
  findAll(
    @Req() req: Request & { user: JwtUserPayload },
    @Query() query: FindLiveTestsQueryDto,
  ) {
    return this.liveTestService.findAll(req.user.id, query);
  }

  @Get(':id')
  findOne(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.liveTestService.findOne(req.user.id, id);
  }

  // Os registos, às páginas (dos mais recentes para trás)
  @Get(':id/events')
  findEvents(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FindLiveEventsQueryDto,
  ) {
    return this.liveTestService.findEvents(req.user.id, id, query);
  }

  // Em tempo real (SSE): o preço, os registos novos e o estado. Sem o buffer do
  // nginx, para cada aviso chegar logo
  @Sse(':id/stream')
  @Header('X-Accel-Buffering', 'no')
  stream(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.liveTestService.stream(req.user.id, id);
  }

  @Post(':id/stop')
  @HttpCode(200)
  stop(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.liveTestService.stop(req.user.id, id);
  }

  @Delete(':id')
  delete(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.liveTestService.delete(req.user.id, id);
  }
}
