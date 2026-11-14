import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CountryService } from './country.service';
import { JwtUserAuthGuard } from 'src/auth-user/guards/jwt-user-auth.guard';
import { UserAdminGuard } from 'src/auth-user/guards/user-admin.guard';

@Controller('country')
export class CountryController {
  constructor(private readonly countryService: CountryService) {}

  @Post('sync')
  @UseGuards(JwtUserAuthGuard, UserAdminGuard)
  sync() {
    return this.countryService.sync();
  }

  @Get()
  findAll() {
    return this.countryService.findAll();
  }
}
