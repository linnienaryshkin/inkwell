#!/bin/sh
input=$(cat)
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // ""')
dir=$(basename "$cwd")
model=$(echo "$input" | jq -r '.model.display_name // ""')
branch=$(git -C "$cwd" --no-optional-locks rev-parse --abbrev-ref HEAD 2>/dev/null)
used_tokens=$(echo "$input" | jq -r '(.context_window.current_usage | if . then .input_tokens + .cache_creation_input_tokens + .cache_read_input_tokens else 0 end) // 0')
total_tokens=$(echo "$input" | jq -r '.context_window.context_window_size // 0')
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
total_display=$(echo "$total_tokens" | awk '{if($1>=1000) printf "%dk", $1/1000; else print $1}')
used_display=$(echo "$used_tokens" | awk '{if($1>=1000) printf "%dk", $1/1000; else print $1}')

# Build a 10-char block progress bar for a given integer percentage (0-100)
# Usage: make_bar PCT
make_bar() {
  _pct="$1"
  _filled=$(echo "$_pct" | awk '{n=int($1/10+0.5); if(n>10)n=10; if(n<0)n=0; print n}')
  _empty=$(( 10 - _filled ))
  _bar=""
  _i=0
  while [ "$_i" -lt "$_filled" ]; do
    _bar="${_bar}█"
    _i=$(( _i + 1 ))
  done
  _i=0
  while [ "$_i" -lt "$_empty" ]; do
    _bar="${_bar}░"
    _i=$(( _i + 1 ))
  done
  printf "%s" "$_bar"
}

# Build context usage inline segment (appended to line 1)
ctx_inline=""
if [ -n "$used_pct" ] && [ "$total_tokens" -gt 0 ] 2>/dev/null; then
  ctx_bar=$(make_bar "$(printf '%.0f' "$used_pct")")
  pct_int=$(printf '%.0f' "$used_pct")
  ctx_inline="  \033[32m${ctx_bar}  ${pct_int}% (${used_display}/${total_display})\033[0m"
elif [ "$total_tokens" -gt 0 ] 2>/dev/null; then
  ctx_inline="  ${used_display}/${total_display}"
fi

# Build 5-hour rate limit line
five_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
five_line=""
if [ -n "$five_pct" ]; then
  five_bar=$(make_bar "$(printf '%.0f' "$five_pct")")
  five_int=$(printf '%.0f' "$five_pct")
  five_line="\n5h  \033[32m${five_bar}\033[0m  ${five_int}%"
fi

# Build 7-day rate limit line
seven_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
seven_line=""
if [ -n "$seven_pct" ]; then
  seven_bar=$(make_bar "$(printf '%.0f' "$seven_pct")")
  seven_int=$(printf '%.0f' "$seven_pct")
  seven_line="\n7d  \033[32m${seven_bar}\033[0m  ${seven_int}%"
fi

# Build cost string (grey)
cost_usd=$(echo "$input" | jq -r '.cost.total_cost_usd // empty')
cost_str=""
if [ -n "$cost_usd" ]; then
  cost_str=$(echo "$cost_usd" | awk '{printf "  \033[90m$%.4f\033[0m", $1}')
fi

if [ -n "$branch" ]; then
  printf "\033[32m➜\033[0m  \033[36m%s\033[0m  \033[33m%s\033[0m  \033[35m%s\033[0m" "$dir" "$branch" "$model"
else
  printf "\033[32m➜\033[0m  \033[36m%s\033[0m  \033[35m%s\033[0m" "$dir" "$model"
fi
printf "%b%b" "$ctx_inline" "$cost_str"
printf "%b%b" "$five_line" "$seven_line"
