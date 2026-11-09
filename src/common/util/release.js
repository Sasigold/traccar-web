// The release a build reports (FND-05): the product's semantic version plus the commit,
// "1.0.0+3f2a9c1". Pure, used by vite.config.js and unit-tested.

export const releaseOf = ({ version, sha }) => {
  const commit = /^[0-9a-f]{7,40}$/i.test(sha || '') ? sha.slice(0, 7).toLowerCase() : 'local';
  return `${version}+${commit}`;
};

// version.json, served next to index.html: what is deployed, for the deploy check and support.
export const releaseFile = ({ version, sha, environment, builtAt }) => ({
  release: releaseOf({ version, sha }),
  version,
  commit: /^[0-9a-f]{7,40}$/i.test(sha || '') ? sha.toLowerCase() : null,
  environment,
  builtAt,
});
