import { Controller, Delete, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UsuarioPerfil } from '../usuarios/usuarios.service';
import { GoogleCalendarService } from './google-calendar.service';

@Controller('google-calendar')
export class GoogleCalendarController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Get('connect')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('PROFESIONAL')
  connect(@CurrentUser() user: UsuarioPerfil) {
    return this.googleCalendarService.getConnectUrl(user);
  }

  @Get('callback')
  callback(@Query('code') code: string, @Query('state') state: string) {
    return this.googleCalendarService.handleCallback(code, state);
  }

  @Get('status')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('PROFESIONAL')
  status(@CurrentUser() user: UsuarioPerfil) {
    return this.googleCalendarService.getStatus(user);
  }

  @Delete('disconnect')
  @UseGuards(DevAuthGuard, RolesGuard)
  @Roles('PROFESIONAL')
  disconnect(@CurrentUser() user: UsuarioPerfil) {
    return this.googleCalendarService.disconnect(user);
  }
}
