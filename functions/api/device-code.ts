// Proxy for GitHub OAuth device code request
// github.com/login/oauth/device/code does not support CORS
export const onRequestPost: PagesFunction = async ({ request }) => {
  const body = await request.json()
  const resp = await fetch('https://github.com/login/oauth/device/code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await resp.json()
  return new Response(JSON.stringify(data), {
    status: resp.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
