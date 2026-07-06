import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUserData } from '../types/auth.types';

/**
 * Extracts the authenticated user (populated by JwtStrategy) from the request.
 * Usage: `@CurrentUser() user: CurrentUserData`
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as CurrentUserData;
  },
);
