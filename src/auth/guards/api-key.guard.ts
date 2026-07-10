import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { safeEqual } from '../../lib/safe-compare.util';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('API key is missing');
    }

    const validApiKey = this.configService.get<string>('SALUD_API_KEY');

    // safeEqual en vez de `!==`: una comparación normal corta apenas encuentra el
    // primer caracter distinto, lo que permite adivinar la API key caracter por
    // caracter midiendo el tiempo de respuesta (este endpoint ya tiene rate limiting,
    // pero eso solo limita la velocidad del ataque, no lo vuelve imposible).
    if (!validApiKey || !safeEqual(apiKey, validApiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
