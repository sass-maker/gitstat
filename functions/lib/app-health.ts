import { createAppHealthClient, type AppHealthClient } from '@saas-maker/app-health'

export interface AppHealthBindings {
  APP_HEALTH_INGEST_KEY?: string
  APP_HEALTH_ENVIRONMENT?: string
}

export function appHealthClient(env: AppHealthBindings): AppHealthClient | null {
  const key = env.APP_HEALTH_INGEST_KEY?.trim()
  if (!key) return null

  return createAppHealthClient({
    key,
    environment: env.APP_HEALTH_ENVIRONMENT?.trim() || 'production',
    endpoint: 'https://ingest.sassmaker.com/v1/ingest',
    runtime: 'worker',
    disableTimer: true,
  })
}
