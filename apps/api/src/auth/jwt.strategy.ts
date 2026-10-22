import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from './auth.service';

/** Token diambil dari cookie httpOnly, dengan fallback header Authorization. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request): string | null =>
          (request?.cookies as Record<string, string> | undefined)?.absensi_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, mentorId: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesi tidak valid. Silakan login kembali.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mentorId: user.mentorId,
    };
  }
}
