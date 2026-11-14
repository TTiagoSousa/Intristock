import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserService } from './user.service';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { UserAdminGuard } from 'src/auth-user/guards/user-admin.guard';
import { JwtUserPayload } from 'src/auth-user/jwt-payload.interface';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';
import { BlockUserDto } from './dto/block-user.dto';

@Controller('user')
@UseGuards(JwtUserAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  findCurrent(@Req() req: Request & { user: JwtUserPayload }) {
    return this.userService.findCurrent(req.user.id);
  }

  @Patch('me/password')
  @HttpCode(200)
  changePassword(@Req() req: Request & { user: JwtUserPayload }, @Body() dto: ChangePasswordDto) {
    return this.userService.changePassword(req.user.id, dto);
  }

  // Não há registo público: as contas novas são criadas pelo admin
  @Get()
  @UseGuards(UserAdminGuard)
  findAll() {
    return this.userService.findAll();
  }

  @Post()
  @UseGuards(UserAdminGuard)
  create(@Body() dto: CreateManagedUserDto) {
    return this.userService.create(dto);
  }

  @Patch(':id')
  @UseGuards(UserAdminGuard)
  update(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id') id: string,
    @Body() dto: UpdateManagedUserDto,
  ) {
    return this.userService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(UserAdminGuard)
  remove(@Req() req: Request & { user: JwtUserPayload }, @Param('id') id: string) {
    return this.userService.remove(req.user.id, id);
  }

  @Post(':id/block')
  @HttpCode(200)
  @UseGuards(UserAdminGuard)
  block(
    @Req() req: Request & { user: JwtUserPayload },
    @Param('id') id: string,
    @Body() dto: BlockUserDto,
  ) {
    return this.userService.block(req.user.id, id, dto);
  }

  @Delete(':id/block')
  @UseGuards(UserAdminGuard)
  unblock(@Param('id') id: string) {
    return this.userService.unblock(id);
  }
}
