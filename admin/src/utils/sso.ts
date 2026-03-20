const SSO_BASE = 'https://authenticator.unlikeother.ai'

export function buildSsoUrl(callbackUrl: string): string {
  const url = new URL('/authorize', SSO_BASE)
  url.searchParams.set('callback', callbackUrl)
  return url.toString()
}
