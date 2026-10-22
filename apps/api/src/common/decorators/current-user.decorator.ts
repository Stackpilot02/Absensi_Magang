import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  mentorId: string | null;
}

/** Mengambil user yang sudah terautentikasi dari request. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, context: ExecutionContext): AuthUser | AuthUser[keyof AuthUser] => {
    const request = context.switchToHttp().getRequest<{ user: AuthUser }>();
    return data ? request.user?.[data] : request.user;
  },
);
