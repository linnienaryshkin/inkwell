#!/bin/sh
# Claude statusline renderer - single line output

input=$(cat)

# Debug: uncomment to inspect JSON structure
# echo "$input" | jq '.' > statusline-context.json

# Extract basic info
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // ""')
dir=$(basename "$cwd")
model=$(echo "$input" | jq -r '.model.display_name // ""')
branch=$(git -C "$cwd" --no-optional-locks rev-parse --abbrev-ref HEAD 2>/dev/null)

# Token usage
used_tokens=$(echo "$input" | jq -r '
  if .context_window.current_usage != null then
    (.context_window.current_usage.input_tokens // 0)
    + (.context_window.current_usage.cache_creation_input_tokens // 0)
    + (.context_window.current_usage.cache_read_input_tokens // 0)
  else 0 end')

total_tokens=$(echo "$input" | jq -r '.context_window.context_window_size // 0')
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

# Format numbers: 27000 → 27K
fmt_k() {
	echo "$1" | awk '{if($1>=1000) printf "%.0fK",$1/1000; else print $1}'
}

total_display=$(fmt_k "$total_tokens")
used_display=$(fmt_k "$used_tokens")

# Progress bar: 14% → ████░░░░░░
make_bar() {
	_filled=$(echo "$1" | awk '{n=int($1/10+0.5); if(n>10)n=10; if(n<0)n=0; print n}')
	_empty=$((10 - _filled))
	_bar=""
	_i=0
	while [ "$_i" -lt "$_filled" ]; do
		_bar="${_bar}█"
		_i=$((_i + 1))
	done
	_i=0
	while [ "$_i" -lt "$_empty" ]; do
		_bar="${_bar}░"
		_i=$((_i + 1))
	done
	printf "%s" "$_bar"
}

# Cost
cost_usd=$(echo "$input" | jq -r '.cost.total_cost_usd // empty')

# Rate limits
five_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
five_reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
seven_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
seven_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

# Human-readable reset time
format_reset_time() {
	_now=$(date +%s)
	_reset_ts=$1
	if [ "$_reset_ts" -le 0 ]; then
		printf "now"
		return
	fi

	# Get today's date at midnight
	_today_start=$(date -v0H -v0M -v0S +%s 2>/dev/null || date -d "today 00:00:00" +%s 2>/dev/null)
	_tomorrow_start=$((_today_start + 86400))

	# If reset is today, show time (HH:MM)
	if [ "$_reset_ts" -lt "$_tomorrow_start" ]; then
		date -r "$_reset_ts" +%H:%M 2>/dev/null || date -d "@$_reset_ts" +%H:%M
	else
		# Otherwise show date (Mon d, e.g., Apr 13)
		date -r "$_reset_ts" +%b\ %d 2>/dev/null || date -d "@$_reset_ts" +%b\ %d
	fi
}

# Color based on remaining percentage
get_limit_color() {
	_remaining=$1
	if [ "$_remaining" -lt 25 ]; then
		printf '%s' "$C_RED"
	else
		printf '%s' "$C_GRAY"
	fi
}

# ANSI color codes (using printf for proper escape interpretation)
C_CYAN=$(printf '\033[96m')      # directory (bright cyan)
C_BLUE=$(printf '\033[34m')      # git: prefix (dark blue)
C_RED=$(printf '\033[31m')       # (branch) name
C_MAGENTA=$(printf '\033[35m')   # model
C_GREEN=$(printf '\033[32m')     # progress bar
C_GRAY=$(printf '\033[90m')      # numbers
C_RESET=$(printf '\033[0m')      # reset color

# Build output line
# cyan directory
printf "%s%s%s" "$C_CYAN" "$dir" "$C_RESET"

# dark blue git:(, red branch, dark blue )
if [ -n "$branch" ]; then
	printf " %sgit:(%s%s%s)%s" "$C_BLUE" "$C_RED" "$branch" "$C_BLUE" "$C_RESET"
fi

# magenta model
printf " %s%s%s" "$C_MAGENTA" "$model" "$C_RESET"

# Add progress bar and tokens if we have data
if [ "$total_tokens" -gt 0 ] 2>/dev/null; then
	pct_int=$(printf '%.0f' "${used_pct:-0}")
	bar=$(make_bar "$pct_int")
	# green bar, gray numbers
	printf " %s%s%s %s%s/%s, %s%%%s" "$C_GREEN" "$bar" "$C_RESET" "$C_GRAY" "$used_display" "$total_display" "$pct_int" "$C_RESET"
fi

# Add cost if available
if [ -n "$cost_usd" ]; then
	printf ", %s\$%.2f%s" "$C_GRAY" "$cost_usd" "$C_RESET"
fi

printf "\n"

# Second line: Rate limits (if available)
if [ -n "$five_pct" ] || [ -n "$seven_pct" ]; then
	printf "  "  # indent

	# 5-hour limit
	if [ -n "$five_pct" ]; then
		five_int=$(printf '%.0f' "$five_pct")
		five_remaining=$((100 - five_int))
		five_color=$(get_limit_color "$five_remaining")
		five_reset_display=""
		[ -n "$five_reset" ] && five_reset_display=$(format_reset_time "$five_reset")
		printf "%s5h limit - %s%s%%%s" "$C_GRAY" "$five_color" "$five_remaining" "$C_RESET"
		if [ -n "$five_reset_display" ]; then
			printf " %suntil %s%s" "$C_GRAY" "$five_reset_display" "$C_RESET"
		fi
	fi

	# separator
	if [ -n "$five_pct" ] && [ -n "$seven_pct" ]; then
		printf " | "
	fi

	# 7-day limit
	if [ -n "$seven_pct" ]; then
		seven_int=$(printf '%.0f' "$seven_pct")
		seven_remaining=$((100 - seven_int))
		seven_color=$(get_limit_color "$seven_remaining")
		seven_reset_display=""
		[ -n "$seven_reset" ] && seven_reset_display=$(format_reset_time "$seven_reset")
		printf "%s7d limit - %s%s%%%s" "$C_GRAY" "$seven_color" "$seven_remaining" "$C_RESET"
		if [ -n "$seven_reset_display" ]; then
			printf " %suntil %s%s" "$C_GRAY" "$seven_reset_display" "$C_RESET"
		fi
	fi

	printf "\n"
fi
