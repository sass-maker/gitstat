const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface TokenResponse {
  access_token: string
  token_type: string
  scope: string
  error?: string
  error_description?: string
  interval?: number
}

export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const resp = await fetch('/api/device-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: 'read:org read:user repo' }),
  })
  if (!resp.ok) throw new Error(`Device code request failed: ${resp.status}`)
  return resp.json()
}

export async function pollForToken(deviceCode: string, interval: number): Promise<TokenResponse> {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  while (true) {
    await wait(interval * 1000)
    const resp = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    })
    const data: TokenResponse = await resp.json()

    if (data.access_token) return data
    if (data.error === 'authorization_pending') continue
    if (data.error === 'slow_down') {
      interval = (data.interval || interval + 5)
      continue
    }
    if (data.error === 'expired_token') throw new Error('Device code expired. Please try again.')
    if (data.error === 'access_denied') throw new Error('Authorization denied by user.')
    throw new Error(data.error_description || data.error || 'Unknown OAuth error')
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem('github_token')
}

export function storeToken(token: string) {
  localStorage.setItem('github_token', token)
}

export function clearToken() {
  localStorage.removeItem('github_token')
}
