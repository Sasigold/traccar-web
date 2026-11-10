#!/usr/bin/env sh
# FND-09: the fortnightly look at what upstream Traccar Web changed. It merges nothing: it lists
# the new upstream commits, the files each touches, and whether viper fleet changed those files
# since the fork (a "clean" file can take the fix as is; a changed one needs a hand port).
# Usage: sh tools/upstream-review.sh            (lists commits after the last reviewed one)
#        sh tools/upstream-review.sh <commit>    (lists commits after <commit>)
# Record a label for each commit (import / skip / not relevant) in docs/UPSTREAM.md, then set the
# last reviewed commit there. To import a fix: git cherry-pick -x <commit>.
set -eu
cd "$(dirname "$0")/.."
FORK_BASE=30c730bd18ad1af040eea2438a41790597b7720a
git remote get-url upstream >/dev/null 2>&1 || git remote add upstream https://github.com/traccar/traccar-web.git
git fetch -q upstream master
SINCE="${1:-$(sed -n 's/^Last reviewed upstream commit: `\([0-9a-f]*\)`.*/\1/p' docs/UPSTREAM.md)}"
SINCE="${SINCE:-$FORK_BASE}"
echo "Upstream commits after ${SINCE}:"
git log --reverse --format='%H' "${SINCE}..upstream/master" | while read -r commit; do
  echo
  git log -1 --format='%h  %ad  %s' --date=short "$commit"
  git diff-tree --no-commit-id --name-only -r "$commit" | while read -r file; do
    if [ -e "$file" ] && git diff --quiet "$FORK_BASE" HEAD -- "$file"; then
      echo "    clean    $file"
    elif [ -e "$file" ]; then
      echo "    changed  $file"
    else
      echo "    gone     $file"
    fi
  done
done
