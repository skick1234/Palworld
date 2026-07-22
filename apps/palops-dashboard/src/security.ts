export function credentialsWereAccepted(status: number): boolean {
  return status !== 401 && status !== 429;
}
