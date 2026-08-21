// Proxy for GitHub OAuth device code request
// github.com/login/device/code does not support CORS
export const onRequestPost: PagesFunction = async ({ request }) => {
  const body = await request.json()
  const resp = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await resp.text()
  return new Response(text, {
    status: resp.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
