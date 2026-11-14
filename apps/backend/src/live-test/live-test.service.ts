import { Injectable } from '@nestjs/common';
import { CreateLiveTestDto } from './dto/create-live-test.dto';
import { FindLiveEventsQueryDto } from './dto/find-live-events-query.dto';
import { FindLiveTestsQueryDto } from './dto/find-live-tests-query.dto';
import { createLiveTest } from './helpers/createLiveTest';
import { deleteLiveTest } from './helpers/deleteLiveTest';
import { findLiveTest } from './helpers/findLiveTest';
import { findLiveTestEvents } from './helpers/findLiveTestEvents';
import { findLiveTests } from './helpers/findLiveTests';
import { stopLiveTest } from './helpers/stopLiveTest';
import { streamLiveTest } from './helpers/streamLiveTest';
import { LiveTestEventsService } from './live-test-events.service';
import { PrismaLiveTestRepository } from './repositories/prisma/prisma-live-test-repository';

@Injectable()
export class LiveTestService {
  constructor(
    private readonly repository: PrismaLiveTestRepository,
    private readonly events: LiveTestEventsService,
  ) {}

  create(userId: string, dto: CreateLiveTestDto) {
    return createLiveTest(userId, dto, this.repository);
  }

  findAll(userId: string, query: FindLiveTestsQueryDto) {
    return findLiveTests(userId, query, this.repository);
  }

  findOne(userId: string, id: string) {
    return findLiveTest(userId, id, this.repository);
  }

  findEvents(userId: string, id: string, query: FindLiveEventsQueryDto) {
    return findLiveTestEvents(userId, id, query, this.repository);
  }

  stop(userId: string, id: string) {
    return stopLiveTest(userId, id, this.repository);
  }

  delete(userId: string, id: string) {
    return deleteLiveTest(userId, id, this.repository);
  }

  stream(userId: string, id: string) {
    return streamLiveTest(userId, id, this.repository, this.events);
  }
}
