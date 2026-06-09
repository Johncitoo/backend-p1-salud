import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsuariosModule } from './usuarios/usuarios.module';
import { PacientesModule } from './pacientes/pacientes.module';
import { ZonasModule } from './zonas/zonas.module';
import { ProfesionalesModule } from './profesionales/profesionales.module';
import { AuditoriasModule } from './auditorias/auditorias.module';
import { getDatabaseConfig } from './config/database.config';
import { authConfig } from './config/auth.config';
import { AuthModule } from './auth/auth.module';

const isTest = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [authConfig],
    }),
    TypeOrmModule.forRootAsync(
      isTest
        ? {
            useFactory: () => ({
              type: 'sqlite',
              database: ':memory:',
              autoLoadEntities: true,
              synchronize: true,
            }),
          }
        : {
            inject: [ConfigService],
            useFactory: getDatabaseConfig,
          },
    ),
    AuthModule,
    UsuariosModule,
    PacientesModule,
    ZonasModule,
    ProfesionalesModule,
    AuditoriasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
