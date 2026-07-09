/** Shape of the JWT payload we sign and verify. */
export interface JwtPayload {
  sub: string; // userId
  phone: string;
  businessId: string | null;
  jti?: string;   // present on tokens issued after plan 005
}

/** Shape exposed to controllers via the @CurrentUser() decorator. */
export interface CurrentUserData {
  userId: string;
  phone: string;
  businessId: string | null;
}
