#!/bin/sh
input=$(cat)
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // ""')
dir=$(basename "$cwd")
model=$(echo "$input" | jq -r '.model.display_name // ""')
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

# Build context usage string
ctx=""
if [ -n "$used" ]; then
  ctx=" ctx:$(printf '%.0f' "$used")%"
fi

printf "\033[32m➜\033[0m  \033[36m%s\033[0m  \033[35m%s\033[0m%s" "$dir" "$model" "$ctx"
