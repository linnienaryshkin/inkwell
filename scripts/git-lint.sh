#!/usr/bin/env sh
#
# Inkwell Git Lint Validator
#
# Validates commit messages and branch names against project conventions.
# Three modes:
#   commit-msg <msg-file>   — validates a single commit message file
#   branch <branch-name>    — validates a branch name
#   pr-commits <base> <head> — validates all commits in a range
#
# Exit codes:
#   0 — validation passed
#   1 — validation failed (with error printed to stderr)
#

set -e

# Colors for output (disable in CI)
if [ -z "$CI" ]; then
  RED='\033[0;31m'
  YELLOW='\033[1;33m'
  NC='\033[0m'
else
  RED=''
  YELLOW=''
  NC=''
fi

# Commit message regex: #ISSUE: description (POSIX basic regex for grep)
# - Must start with # followed by digits
# - Colon-space separator
# - At least one character of description
COMMIT_MSG_REGEX='^#[0-9]\+: ..\+'

# Branch name regex: main | (feature|bugfix|hotfix|article|chore)/#ISSUE/slug (extended regex for grep -E)
# - main (bare)
# - feature/#123/slug, bugfix/#456/slug, etc.
# - Issue number: 1+ digits
# - slug must be lowercase alphanumeric with hyphens, at least 1 char
BRANCH_NAME_REGEX='^(main|(feature|bugfix|hotfix|article|chore)/#[0-9]+/[a-z0-9][a-z0-9-]*)$'

validate_commit_msg() {
  local msg_file="$1"
  local msg
  local header
  local description

  # Read the commit message (first line is the header)
  if [ ! -f "$msg_file" ]; then
    echo "${RED}Error: commit message file not found: $msg_file${NC}" >&2
    return 1
  fi

  msg=$(cat "$msg_file")
  header=$(echo "$msg" | head -n 1)

  # Skip empty commits or merge commits (via git commit --allow-empty or automatic merges)
  if [ -z "$header" ] || echo "$header" | grep -q "^Merge "; then
    return 0
  fi

  # Validate format: #ISSUE: description
  if ! echo "$header" | grep -q "$COMMIT_MSG_REGEX"; then
    echo "${RED}Error: invalid commit message format${NC}" >&2
    echo "${YELLOW}Expected: #ISSUE: description${NC}" >&2
    echo "${YELLOW}Example:  #42: add dark mode${NC}" >&2
    echo "${YELLOW}Got:      $header${NC}" >&2
    return 1
  fi

  # Check header max length (72 chars, git standard)
  local header_len=${#header}
  if [ "$header_len" -gt 72 ]; then
    echo "${RED}Error: commit message header exceeds 72 characters ($header_len chars)${NC}" >&2
    echo "${YELLOW}Header: $header${NC}" >&2
    return 1
  fi

  # Check that header doesn't end with a period
  if echo "$header" | grep -q '\.$ '; then
    echo "${RED}Error: commit message header must not end with a period${NC}" >&2
    echo "${YELLOW}Got: $header${NC}" >&2
    return 1
  fi

  return 0
}

validate_branch_name() {
  local branch="$1"

  if [ -z "$branch" ]; then
    echo "${RED}Error: branch name is empty${NC}" >&2
    return 1
  fi

  # Allow main (no prefix required)
  if [ "$branch" = "main" ]; then
    return 0
  fi

  # Validate against regex
  if ! echo "$branch" | grep -E "$BRANCH_NAME_REGEX" > /dev/null; then
    echo "${RED}Error: invalid branch name${NC}" >&2
    echo "${YELLOW}Expected format:${NC}" >&2
    echo "  - 'main' (bare)" >&2
    echo "  - 'feature/#ISSUE/slug' (e.g. feature/#149/git-lint-rules)" >&2
    echo "  - 'bugfix/#ISSUE/slug'" >&2
    echo "  - 'hotfix/#ISSUE/slug'" >&2
    echo "  - 'article/#ISSUE/slug'" >&2
    echo "  - 'chore/#ISSUE/slug'" >&2
    echo "${YELLOW}Got: $branch${NC}" >&2
    return 1
  fi

  return 0
}

validate_pr_commits() {
  local base="$1"
  local head="$2"

  if [ -z "$base" ] || [ -z "$head" ]; then
    echo "${RED}Error: base and head refs are required${NC}" >&2
    return 1
  fi

  # Edge case: first push to new branch (base is all zeros)
  if echo "$base" | grep -q '^0\{40\}$'; then
    # Validate only the tip commit
    local msg_file
    msg_file=$(mktemp)
    git log -1 --format=%B "$head" > "$msg_file"
    validate_commit_msg "$msg_file"
    local result=$?
    rm -f "$msg_file"
    return $result
  fi

  # Validate all commits in the range
  local commit_range="${base}..${head}"
  local commit_count
  commit_count=$(git rev-list --count "$commit_range" 2>/dev/null || echo "0")

  if [ "$commit_count" = "0" ]; then
    # No commits in range (e.g., fast-forward merge)
    return 0
  fi

  # Check each commit message
  local failed=0
  while IFS= read -r commit_hash; do
    local msg_file
    msg_file=$(mktemp)
    git log -1 --format=%B "$commit_hash" > "$msg_file"
    if ! validate_commit_msg "$msg_file"; then
      echo "${YELLOW}  (in commit: $commit_hash)${NC}" >&2
      failed=1
    fi
    rm -f "$msg_file"
  done <<EOF
$(git rev-list "$commit_range")
EOF

  if [ "$failed" = "1" ]; then
    return 1
  fi

  return 0
}

main() {
  local mode="$1"
  shift

  case "$mode" in
    commit-msg)
      validate_commit_msg "$@"
      ;;
    branch)
      validate_branch_name "$@"
      ;;
    pr-commits)
      validate_pr_commits "$@"
      ;;
    *)
      echo "${RED}Error: unknown mode '$mode'${NC}" >&2
      echo "Usage:" >&2
      echo "  $0 commit-msg <msg-file>" >&2
      echo "  $0 branch <branch-name>" >&2
      echo "  $0 pr-commits <base> <head>" >&2
      return 1
      ;;
  esac
}

main "$@"
