# Shared by the deploy scripts. POSIX sh; source it, do not run it.

# pick_container <image-regex> <override>
# Reads `docker ps --format '{{.Names}} {{.Image}}'` on stdin and prints the one container to use.
# FND-04: with a staging stack next to production on the same server, "the first supabase/postgres"
# could be either, so a second match is an error unless the override names the container.
pick_container() {
  pattern="$1"
  override="$2"
  list=$(cat)
  if [ -n "$override" ]; then
    if printf '%s\n' "$list" | awk -v name="$override" '$1 == name { found = 1 } END { exit !found }'; then
      printf '%s\n' "$override"
      return 0
    fi
    echo "Container '$override' is not running." >&2
    return 1
  fi
  matches=$(printf '%s\n' "$list" | awk -v re="$pattern" '$2 ~ re { print $1 }')
  count=$(printf '%s' "$matches" | grep -c . || true)
  if [ "$count" = 1 ]; then
    printf '%s\n' "$matches"
    return 0
  fi
  if [ "$count" = 0 ]; then
    echo "No running container matches $pattern." >&2
  else
    echo "More than one container matches $pattern; name the one to use:" >&2
    printf '  %s\n' $matches >&2
  fi
  return 1
}
