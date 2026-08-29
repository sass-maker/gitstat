const product = {
  schemaVersion: 1,
  name: 'GitStat',
  description:
    'Free public cross-repository analytics for GitHub effort, churn, collaboration, pull requests, issues, and sampled AI involvement.',
  audience:
    'Developers managing enough GitHub repositories that the normal contribution graph no longer answers where work is going.',
  outcome:
    'See how engineering effort and change are distributed while keeping the underlying repositories available as evidence.',
  mechanism:
    'A browser dashboard aggregates public GitHub API data across repositories and organizations, then computes separate activity, churn, collaboration, pull-request, issue, cadence, and sampled AI-signal views.',
  access: {
    price: 'free',
    accountRequired: false,
    publicRepositories: true,
    privateRepositories: false,
    oauthAvailable: false,
  },
  dataBoundary: {
    processing: 'browser',
    cache: 'local device, one-hour TTL',
    productAnalytics: false,
    serverAccountStore: false,
  },
  caveats: [
    'AI involvement is inferred from sampled public commit metadata and is not proof of authorship.',
    'Line counts describe change volume and are not a productivity score.',
    'The shared GitHub API allowance may rate-limit large analyses.',
  ],
  source: 'https://github.com/sass-maker/gitstat',
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  const origin = new URL(request.url).origin
  const catalog = {
    ...product,
    url: `${origin}/`,
    llms: `${origin}/llms.txt`,
    sitemap: `${origin}/sitemap.xml`,
    markdown: `${origin}/index.md`,
    surfaces: [{ id: 'home', url: `${origin}/`, md: `${origin}/index.md` }],
    pricing: `${origin}/pricing.md`,
  }

  return new Response(JSON.stringify(catalog, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
