#!/bin/sh
input=$(cat)
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // ""')
dir=$(basename "$cwd")
model=$(echo "$input" | jq -r '.model.display_name // ""')
branch=$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null)
used_tokens=$(echo "$input" | jq -r '(.context_window.current_usage | if . then .input_tokens + .cache_creation_input_tokens + .cache_read_input_tokens else 0 end) // 0')
total_tokens=$(echo "$input" | jq -r '.context_window.context_window_size // 0')
total_display=$(echo "$total_tokens" | awk '{if($1>=1000) printf "%dK", $1/1000; else print $1}')
used_display=$(echo "$used_tokens" | awk '{if($1>=1000) printf "%dK", $1/1000; else print $1}')

# Build context usage string
ctx=""
if [ "$total_tokens" -gt 0 ] 2>/dev/null; then
  ctx="  ${used_display}/${total_display}"
fi

# Build cost string
cost_usd=$(echo "$input" | jq -r '.cost.total_cost_usd // empty')
cost_str=""
if [ -n "$cost_usd" ]; then
  cost_str=$(echo "$cost_usd" | awk '{printf "  $%.4f", $1}')
fi
  
if [ -n "$branch" ]; then
  printf "\033[32m➜\033[0m  \033[36m%s\033[0m  \033[33m%s\033[0m  \033[35m%s\033[0m%s%s" "$dir" "$branch" "$model" "$ctx" "$cost_str"
else
  printf "\033[32m➜\033[0m  \033[36m%s\033[0m  \033[35m%s\033[0m%s%s" "$dir" "$model" "$ctx" "$cost_str"
fi
