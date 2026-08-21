// Proxy for GitHub OAuth token polling
// github.com/login/oauth/access_token does not support CORS
interface TokenEnv {
  GH_CLIENT_SECRET?: string
}

export const onRequestPost: PagesFunction<TokenEnv> = async ({ request, env }) => {
  const body = await request.json()
  // Inject client_secret server-side so it's never exposed to the client
  const payload: Record<string, string> = { ...body }
  if (env.GH_CLIENT_SECRET) {
    payload.client_secret = env.GH_CLIENT_SECRET
  }
  const resp = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const text = await resp.text()
  return new Response(text, {
    status: resp.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
