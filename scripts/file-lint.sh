#!/usr/bin/env sh
#
# Inkwell File Name Lint Validator
#
# Validates file and folder names against project naming conventions.
# Two modes:
#   ui   — validates TypeScript/TSX files in ui/src/
#   api  — validates Python files in api/app/ and api/tests/
#
# Exit codes:
#   0 — validation passed
#   1 — validation failed (with errors printed to stderr)
#

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

# Strip extension and .test suffix from a filename
# e.g. "EditorPane.test.tsx" -> "EditorPane"
strip_extension() {
  local name="$1"
  # Remove everything from the first dot onwards
  # This handles: .tsx, .ts, .test.tsx, .test.ts, etc.
  echo "$name" | sed 's/\..*$//'
}

validate_ui_files() {
  local error_count=0

  # Check component files (PascalCase)
  if [ -d "ui/src/components" ]; then
    find "ui/src/components" \( -name "*.ts" -o -name "*.tsx" \) | while read -r f; do
      base=$(basename "$f")
      base_clean=$(strip_extension "$base")
      # Check if starts with uppercase (PascalCase)
      if ! echo "$base_clean" | grep -qE '^[A-Z][a-zA-Z0-9]*$'; then
        echo "${RED}ERROR: component file must be PascalCase: $f${NC}" >&2
        echo "${YELLOW}Got: $base${NC}" >&2
      fi
    done
  fi

  # Check hook files (usePascalCase)
  if [ -d "ui/src/hooks" ]; then
    find "ui/src/hooks" \( -name "*.ts" -o -name "*.tsx" \) | while read -r f; do
      base=$(basename "$f")
      base_clean=$(strip_extension "$base")
      if ! echo "$base_clean" | grep -qE '^use[A-Z][a-zA-Z0-9]*$'; then
        echo "${RED}ERROR: hook file must be usePascalCase: $f${NC}" >&2
        echo "${YELLOW}Expected pattern: use[A-Z]...${NC}" >&2
        echo "${YELLOW}Got: $base${NC}" >&2
      fi
    done
  fi

  # Check service files (lowercase)
  if [ -d "ui/src/services" ]; then
    find "ui/src/services" \( -name "*.ts" -o -name "*.tsx" \) | while read -r f; do
      base=$(basename "$f")
      base_clean=$(strip_extension "$base")
      if ! echo "$base_clean" | grep -qE '^[a-z0-9]+$'; then
        echo "${RED}ERROR: service file must be lowercase: $f${NC}" >&2
        echo "${YELLOW}Got: $base${NC}" >&2
      fi
    done
  fi

  # Check app files (lowercase)
  if [ -d "ui/src/app" ]; then
    find "ui/src/app" \( -name "*.ts" -o -name "*.tsx" \) | while read -r f; do
      base=$(basename "$f")
      # Skip next.js special files
      case "$base" in
        layout.* | page.* | _*) continue ;;
      esac
      base_clean=$(strip_extension "$base")
      if ! echo "$base_clean" | grep -qE '^[a-z0-9]+$'; then
        echo "${RED}ERROR: app file must be lowercase: $f${NC}" >&2
        echo "${YELLOW}Got: $base${NC}" >&2
      fi
    done
  fi

  # Check folder names under ui/src/ (all lowercase)
  if [ -d "ui/src" ]; then
    find "ui/src" -mindepth 1 -type d | while read -r d; do
      base=$(basename "$d")
      if ! echo "$base" | grep -qE '^[a-z0-9]+$'; then
        echo "${RED}ERROR: folder must be lowercase: $d${NC}" >&2
        echo "${YELLOW}Got: $base${NC}" >&2
      fi
    done
  fi
}

validate_api_files() {
  # Check Python files in api/app/ and api/tests/ (snake_case)
  for dir in "api/app" "api/tests"; do
    if [ ! -d "$dir" ]; then
      continue
    fi
    find "$dir" -name "*.py" | while read -r f; do
      base=$(basename "$f")
      # Skip dunder files
      case "$base" in
        __*) continue ;;
      esac
      # Check snake_case
      if ! echo "$base" | grep -qE '^[a-z][a-z0-9_]*\.py$'; then
        echo "${RED}ERROR: Python file must be snake_case: $f${NC}" >&2
        echo "${YELLOW}Got: $base${NC}" >&2
      fi
    done
  done

  # Check folder names (lowercase)
  for dir in "api/app" "api/tests"; do
    if [ ! -d "$dir" ]; then
      continue
    fi
    find "$dir" -mindepth 1 -type d | while read -r d; do
      base=$(basename "$d")
      case "$base" in
        __*) continue ;;
      esac
      if ! echo "$base" | grep -qE '^[a-z][a-z0-9_]*$'; then
        echo "${RED}ERROR: folder must be lowercase: $d${NC}" >&2
        echo "${YELLOW}Got: $base${NC}" >&2
      fi
    done
  done
}

main() {
  local mode="$1"
  local error_output

  # Capture error output
  case "$mode" in
    ui)
      error_output=$(validate_ui_files 2>&1 >/dev/null)
      ;;
    api)
      error_output=$(validate_api_files 2>&1 >/dev/null)
      ;;
    *)
      echo "${RED}Error: unknown mode '$mode'${NC}" >&2
      echo "Usage:" >&2
      echo "  $0 ui   — validate TypeScript files in ui/src/" >&2
      echo "  $0 api  — validate Python files in api/" >&2
      return 1
      ;;
  esac

  # Re-run to actually output to stderr
  case "$mode" in
    ui)
      validate_ui_files
      ;;
    api)
      validate_api_files
      ;;
  esac

  # Check if there were any errors
  if [ -n "$error_output" ]; then
    return 1
  fi
  return 0
}

main "$@"
