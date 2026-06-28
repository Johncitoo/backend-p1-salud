import { Controller, Delete, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UsuarioPerfil } from '../usuarios/usuarios.service';
import { GoogleCalendarService } from './google-calendar.service';

@Controller('google-calendar')
@UseGuards(DevAuthGuard, RolesGuard)
export class GoogleCalendarController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Get('connect')
  @Roles('PROFESIONAL')
  connect(@CurrentUser() user: UsuarioPerfil) {
    return this.googleCalendarService.getConnectUrl(user);
  }

  @Get('callback')
  @Roles('PROFESIONAL')
  callback(@Query('code') code: string, @Query('state') state: string, @CurrentUser() user?: UsuarioPerfil) {
    return this.googleCalendarService.handleCallback(code, state, user);
  }

  @Get('status')
  @Roles('PROFESIONAL')
  status(@CurrentUser() user: UsuarioPerfil) {
    return this.googleCalendarService.getStatus(user);
  }

  @Delete('disconnect')
  @Roles('PROFESIONAL')
  disconnect(@CurrentUser() user: UsuarioPerfil) {
    return this.googleCalendarService.disconnect(user);
  }
}
