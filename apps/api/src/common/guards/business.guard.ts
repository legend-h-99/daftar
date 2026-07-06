import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { CurrentUserData } from '../types/auth.types';

/**
 * Must run after JwtAuthGuard. Ensures the current user has completed
 * onboarding (i.e. belongs to a Business) before accessing business-scoped
 * resources such as products, invoices, customers, expenses, etc.
 */
@Injectable()
export class BusinessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as CurrentUserData | undefined;

    if (!user?.businessId) {
      throw new ForbiddenException(
        'You must complete onboarding (create a business) before accessing this resource.',
      );
    }

    return true;
  }
}
