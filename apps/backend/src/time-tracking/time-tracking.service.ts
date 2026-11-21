import { Injectable } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanySupplierRepository } from 'src/company-supplier/repositories/prisma/prisma-company-supplier-repository';
import { PrismaTimeTrackingRepository } from './repositories/prisma/prisma-time-tracking-repository';
import { TimeTrackingSyncService } from './time-tracking-sync.service';
import { CompanyPaymentService } from 'src/company-payment/company-payment.service';
import { NotificationService } from 'src/notification/notification.service';
import { CreateCompanyPaymentDto } from 'src/company-payment/dto/create-company-payment.dto';
import {
  CheckTimeTrackingDto,
  CreateTimeTrackingConnectionDto,
  CreateTimeTrackingSettlementDto,
  CreateTimeTrackingPayoutDto,
  PayoutsQueryDto,
  SettlementsQueryDto,
  EntriesQueryDto,
  HoursQueryDto,
  TimeTrackingSummaryQueryDto,
  UpdateTimeTrackingClientDto,
  UpdateTimeTrackingConnectionDto,
  UpdateTimeTrackingPersonDto,
} from './dto/time-tracking.dto';
import { findTimeTrackingConnections } from './helpers/findTimeTrackingConnections';
import { checkTimeTrackingConnection } from './helpers/checkTimeTrackingConnection';
import { createTimeTrackingConnection } from './helpers/createTimeTrackingConnection';
import { updateTimeTrackingConnection } from './helpers/updateTimeTrackingConnection';
import { deleteTimeTrackingConnection } from './helpers/deleteTimeTrackingConnection';
import { assertConnectionOfCompany } from './helpers/assertConnectionOfCompany';
import { findTimeTrackingClients } from './helpers/findTimeTrackingClients';
import { updateTimeTrackingClient } from './helpers/updateTimeTrackingClient';
import { findTimeTrackingPeople } from './helpers/findTimeTrackingPeople';
import { updateTimeTrackingPerson } from './helpers/updateTimeTrackingPerson';
import { summarizeHours } from './helpers/summarizeHours';
import { findTimeTrackingEntries } from './helpers/findTimeTrackingEntries';
import { summarizeTimeTracking } from './helpers/summarizeTimeTracking';
import { createTimeTrackingSettlement, SettlementPayments } from './helpers/createTimeTrackingSettlement';
import { findTimeTrackingSettlements } from './helpers/findTimeTrackingSettlements';
import { deleteTimeTrackingSettlement } from './helpers/deleteTimeTrackingSettlement';
import { createTimeTrackingPayout } from './helpers/createTimeTrackingPayout';
import { findTimeTrackingPayouts } from './helpers/findTimeTrackingPayouts';
import { deleteTimeTrackingPayout } from './helpers/deleteTimeTrackingPayout';
import { notifyPayoutPaid } from './helpers/notifyPayoutPaid';

@Injectable()
export class TimeTrackingService {
  constructor(
    private readonly repository: PrismaTimeTrackingRepository,
    private readonly companyRepository: PrismaCompanyRepository,
    private readonly supplierRepository: PrismaCompanySupplierRepository,
    private readonly syncService: TimeTrackingSyncService,
    private readonly paymentService: CompanyPaymentService,
    private readonly notifications: NotificationService,
  ) {}

  // O recebimento na empresa vai pelo serviço dos pagamentos (com as permissões dele)
  private get payments(): SettlementPayments {
    return {
      create: (userId, companyId, dto, options) =>
        this.paymentService.create(userId, companyId, dto as unknown as CreateCompanyPaymentDto, options),
      remove: (userId, companyId, paymentId) => this.paymentService.remove(userId, companyId, paymentId),
    };
  }

  settlements(userId: string, companyId: string, query: SettlementsQueryDto) {
    return findTimeTrackingSettlements(userId, companyId, query, this.repository, this.companyRepository);
  }

  createSettlement(userId: string, companyId: string, dto: CreateTimeTrackingSettlementDto) {
    return createTimeTrackingSettlement(
      userId,
      companyId,
      dto,
      this.repository,
      this.companyRepository,
      this.payments,
    );
  }

  async deleteSettlement(userId: string, companyId: string, settlementId: string) {
    const result = await deleteTimeTrackingSettlement(
      userId,
      companyId,
      settlementId,
      this.repository,
      this.companyRepository,
      this.payments,
    );
    return result;
  }

  payouts(userId: string, companyId: string, query: PayoutsQueryDto) {
    return findTimeTrackingPayouts(userId, companyId, query, this.repository, this.companyRepository);
  }

  createPayout(userId: string, companyId: string, dto: CreateTimeTrackingPayoutDto) {
    return createTimeTrackingPayout(
      userId,
      companyId,
      dto,
      this.repository,
      this.companyRepository,
      this.payments,
      (payoutId) => notifyPayoutPaid(payoutId, this.repository, this.notifications),
    );
  }

  async deletePayout(userId: string, companyId: string, payoutId: string) {
    const result = await deleteTimeTrackingPayout(
      userId,
      companyId,
      payoutId,
      this.repository,
      this.companyRepository,
      this.payments,
    );
    // O aviso a quem recebia deixa de pedir confirmação
    await this.notifications.closeActions('member_paid', 'payoutId', payoutId, 'cancelled');
    return result;
  }

  connections(userId: string, companyId: string) {
    return findTimeTrackingConnections(userId, companyId, this.repository, this.companyRepository, (id) =>
      this.syncService.isSyncing(id),
    );
  }

  check(userId: string, companyId: string, dto: CheckTimeTrackingDto) {
    return checkTimeTrackingConnection(userId, companyId, dto, this.companyRepository);
  }

  async connect(userId: string, companyId: string, dto: CreateTimeTrackingConnectionDto) {
    const connection = await createTimeTrackingConnection(userId, companyId, dto, this.repository, this.companyRepository);
    // A primeira volta (tudo) corre em fundo
    void this.syncService.sync(connection.id);
    return { ...connection, syncing: true };
  }

  updateConnection(userId: string, companyId: string, connectionId: string, dto: UpdateTimeTrackingConnectionDto) {
    return updateTimeTrackingConnection(userId, companyId, connectionId, dto, this.repository, this.companyRepository);
  }

  deleteConnection(userId: string, companyId: string, connectionId: string) {
    return deleteTimeTrackingConnection(userId, companyId, connectionId, this.repository, this.companyRepository);
  }

  async syncNow(userId: string, companyId: string, connectionId: string) {
    await assertConnectionOfCompany(userId, companyId, connectionId, this.repository, this.companyRepository);
    const result = await this.syncService.sync(connectionId);
    return { ...result, connection: await this.repository.findConnectionView(companyId, connectionId) };
  }

  clients(userId: string, companyId: string) {
    return findTimeTrackingClients(userId, companyId, this.repository, this.companyRepository);
  }

  updateClient(userId: string, companyId: string, clientId: string, dto: UpdateTimeTrackingClientDto) {
    return updateTimeTrackingClient(
      userId,
      companyId,
      clientId,
      dto,
      this.repository,
      this.companyRepository,
      this.supplierRepository,
    );
  }

  people(userId: string, companyId: string) {
    return findTimeTrackingPeople(userId, companyId, this.repository, this.companyRepository);
  }

  updatePerson(userId: string, companyId: string, personId: string, dto: UpdateTimeTrackingPersonDto) {
    return updateTimeTrackingPerson(userId, companyId, personId, dto, this.repository, this.companyRepository);
  }

  hours(userId: string, companyId: string, query: HoursQueryDto) {
    return summarizeHours(userId, companyId, query, this.repository, this.companyRepository);
  }

  entries(userId: string, companyId: string, query: EntriesQueryDto) {
    return findTimeTrackingEntries(userId, companyId, query, this.repository, this.companyRepository);
  }

  summary(userId: string, companyId: string, query: TimeTrackingSummaryQueryDto) {
    return summarizeTimeTracking(userId, companyId, query, this.repository, this.companyRepository);
  }
}
