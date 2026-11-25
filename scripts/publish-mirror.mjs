import { spawnSync } from 'node:child_process'

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'Git command failed')
  return result.stdout.trim()
}
if (git(['status', '--porcelain'])) throw new Error('Commit the intended source and documentation before publishing the snapshot.')
const email = git(['config', '--get', 'user.email'])
if (!email.endsWith('@users.noreply.github.com')) throw new Error('Configure a repository-local GitHub noreply email before publishing.')
const source = git(['rev-parse', 'HEAD'])
const tree = git(['rev-parse', 'HEAD^{tree}'])
const ref = 'refs/heads/codex/public-release'
const parentResult = spawnSync('git', ['rev-parse', '--verify', ref], { encoding: 'utf8' })
const parent = parentResult.status === 0 ? parentResult.stdout.trim() : ''
const parentTree = parent ? git(['rev-parse', `${parent}^{tree}`]) : ''
const commit = parentTree === tree ? parent : git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', `Publish GagaOfferLite source snapshot\n\nDeepSpace source commit: ${source}`])
if (commit !== parent) git(['update-ref', ref, commit, ...(parent ? [parent] : [])])
git(['-c', 'http.proxy=', 'push', 'origin', `${ref}:refs/heads/main`])
const remote = git(['-c', 'http.proxy=', 'ls-remote', 'origin', 'refs/heads/main']).split(/\s/)[0]
if (remote !== commit) throw new Error('Remote snapshot did not match the published commit.')
console.log(JSON.stringify({ sourceCommit: source, snapshotCommit: commit, tree, remoteVerified: true }))
