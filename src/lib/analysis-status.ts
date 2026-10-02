// Repository discovery and contributor statistics are different evidence.
// Legacy caches omit discovery, so their empty stats cannot prove empty discovery.
export function getEmptyAnalysisMessage(discoveredRepos: number | null): string {
  if (discoveredRepos === 0) {
    return 'No public repositories were found for this account and its public organizations. Try another username; private repositories are not included.'
  }
  if (discoveredRepos === null) {
    return 'No repository contribution data is stored for this analysis. Refresh to check public repositories; this does not confirm zero GitHub activity.'
  }
  return 'No contribution statistics were returned for the discovered public repositories. Statistics may be unavailable or have no matching contributions. Analyze again; this does not confirm zero GitHub activity.'
}
