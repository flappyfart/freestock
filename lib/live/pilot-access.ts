// Private product access only. This does not assess eligibility for issuer services.
export function hasPrivatePilotAccess(userId: string | null, configuredUserId?: string) {
  return !!userId?.trim() && !!configuredUserId?.trim() && userId === configuredUserId;
}
