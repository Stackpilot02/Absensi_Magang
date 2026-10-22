import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService, PublicUser } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: PublicUser }> {
    const { accessToken, user } = await this.authService.login(dto);

    response.cookie(this.config.get<string>('cookie.name') as string, accessToken, {
      httpOnly: true,
      secure: this.config.get<boolean>('cookie.secure'),
      sameSite: this.config.get<'lax' | 'strict' | 'none'>('cookie.sameSite'),
      maxAge: this.config.get<number>('cookie.maxAgeMs'),
      path: '/',
    });

    return { user };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) response: Response): { message: string } {
    response.clearCookie(this.config.get<string>('cookie.name') as string, { path: '/' });
    return { message: 'Berhasil keluar.' };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.authService.findActiveUser(user.id);
  }

  @Post('change-password')
  @HttpCode(200)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(user.id, dto);
  }
}
