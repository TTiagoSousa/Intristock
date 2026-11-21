import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { CompanyInvitationService } from './company-invitation.service';
import { ConfirmPaymentDto, RespondInvitationDto } from './dto/company-invitation.dto';

type Req = Request & { user: JwtUserPayload };

/** O que as empresas pedem a esta pessoa: convites, propostas de salário e pagamentos a confirmar. */
@Controller('invitations')
@UseGuards(JwtUserAuthGuard)
export class CompanyInvitationController {
  constructor(private readonly service: CompanyInvitationService) {}

  @Get()
  mine(@Req() req: Req) {
    return this.service.mine(req.user.id);
  }

  @Post('members/:id')
  @HttpCode(200)
  respondInvite(@Req() req: Req, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RespondInvitationDto) {
    return this.service.respondInvite(req.user.id, id, dto.accept);
  }

  @Post('pays/:id')
  @HttpCode(200)
  respondProposal(@Req() req: Req, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RespondInvitationDto) {
    return this.service.respondProposal(req.user.id, id, dto.accept, dto.note);
  }

  @Post('payments/:id')
  @HttpCode(200)
  confirmPayment(@Req() req: Req, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmPaymentDto) {
    return this.service.confirmPayment(req.user.id, dto.source, id, dto.received);
  }
}
