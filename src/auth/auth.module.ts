import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { DevAuthGuard } from './guards/dev-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    UsuariosModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          issuer: configService.get<string>('JWT_ISSUER'),
          audience: configService.get<string>('JWT_AUDIENCE'),
        },
      }),
    }),
  ],
  providers: [JwtStrategy, DevAuthGuard, RolesGuard],
  exports: [JwtModule, DevAuthGuard, RolesGuard],
})
export class AuthModule {}
