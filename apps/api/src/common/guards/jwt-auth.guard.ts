import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Protects a route with the 'jwt' passport strategy. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
