import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { CurrentUser } from './auth/decorators/current-user.decorator';
import { DevAuthGuard } from './auth/guards/dev-auth.guard';
import type { UsuarioPerfil } from './usuarios/usuarios.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('me')
  @UseGuards(DevAuthGuard)
  getMe(@CurrentUser() user: UsuarioPerfil): UsuarioPerfil {
    return user;
  }
}
