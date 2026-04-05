"""
GitHub OAuth flow — httponly cookie auth.

    Browser                   Inkwell API              GitHub
       |                           |                      |
       |-- GET /auth/login ------->|                      |
       |                           |-- redirect + CSRF -->|
       |<-- 307 + state cookie ----|                      |
       |                           |                      |
       |-- browser follows GitHub authorize ------------->|
       |<-- GitHub redirects to /auth/callback ----------|
       |                           |                      |
       |-- GET /auth/callback ---->|                      |
       |   ?code=...&state=...     |-- POST /access_token>|
       |                           |<-- access_token -----|
       |<-- 307 to frontend        |                      |
       |   + gh_access_token cookie|                      |
       |                           |                      |
       |-- GET /auth/me ---------->|                      |
       |   (cookie sent auto)      |-- GET /user -------->|
       |                           |<-- profile data -----|
       |<-- 200 UserProfile -------|                      |

Threat model:
- CSRF: state cookie (httponly) is compared to the state query param GitHub echoes back.
  An attacker cannot read the cookie cross-origin, so they cannot forge a valid callback.
- Open redirect: redirect_url is validated against ALLOWED_REDIRECT_URLS at both /login
  and /callback (defense-in-depth). Arbitrary destinations are rejected with 400.
- Token exposure: gh_access_token is httponly — inaccessible to JavaScript.
  It is never logged or included in response bodies.
- Token lifetime: currently inherits GitHub OAuth App token lifetime (no expiry).
  Phase 2 switches to GitHub App User Tokens (8 h expiry + refresh token).
- Stolen cookie: if the session cookie is exfiltrated, there is no server-side revocation
  in this phase. Mitigation: short max_age (8 h in Phase 2) + HTTPS-only (secure=True).
"""

import secrets
import urllib.parse

import httpx
from fastapi import APIRouter, Cookie, HTTPException, Request
from fastapi.responses import RedirectResponse, Response

from app.config import config
from app.models.auth import UserProfile

ALLOWED_REDIRECT_URLS: list[str] = config.allowed_redirect_urls

SESSION_COOKIE = "gh_access_token"
STATE_COOKIE = "gh_oauth_state"

# 8 hours — matches GitHub App User Token lifetime (Phase 2)
_TOKEN_MAX_AGE = 28800

router = APIRouter()


@router.get("/login")
def login(redirect_url: str | None = None) -> RedirectResponse:
    # Validate caller-supplied redirect URL against the allowlist to prevent open redirect.
    # Default to the first allowed URL if none provided.
    if redirect_url is not None:
        if redirect_url not in ALLOWED_REDIRECT_URLS:
            raise HTTPException(status_code=400, detail="Invalid redirect URL")
        chosen_redirect = redirect_url
    else:
        chosen_redirect = ALLOWED_REDIRECT_URLS[0]

    # Encode CSRF state and chosen redirect URL together in one cookie (pipe-delimited).
    # GitHub echoes the state param back in /callback — we split it there to recover both.
    state = secrets.token_urlsafe(32)
    state_value = f"{state}|{chosen_redirect}"

    params = urllib.parse.urlencode(
        {
            "client_id": config.oauth_client_id,
            "redirect_uri": config.oauth_callback_url,  # must match the registered OAuth app URL
            "scope": "read:user",  # minimum scope to read the user profile
            "state": state,  # CSRF protection token (GitHub echoes this back)
        }
    )
    redirect = RedirectResponse(url=f"https://github.com/login/oauth/authorize?{params}")
    redirect.set_cookie(
        key=STATE_COOKIE,
        value=state_value,
        httponly=True,
        samesite="none",
        secure=True,
        max_age=600,  # 10 min — long enough to complete the login flow
    )
    return redirect


@router.get("/callback")
async def callback(
    code: str,  # one-time code from GitHub
    state: str,  # CSRF token echoed back by GitHub
    gh_oauth_state: str | None = Cookie(default=None),  # our CSRF+redirect cookie
) -> RedirectResponse:
    if not gh_oauth_state or "|" not in gh_oauth_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    # Recover CSRF token and redirect URL from the pipe-delimited cookie
    cookie_state, chosen_redirect = gh_oauth_state.split("|", 1)
    if state != cookie_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    # Defense-in-depth: re-validate redirect URL even though we set it ourselves
    if chosen_redirect not in ALLOWED_REDIRECT_URLS:
        raise HTTPException(status_code=400, detail="Invalid redirect URL")

    async with httpx.AsyncClient() as http:
        # Exchange the one-time code for a GitHub access token
        token_resp = await http.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": config.oauth_client_id,
                "client_secret": config.oauth_client_secret,
                "code": code,
                "redirect_uri": config.oauth_callback_url,
            },
            headers={"Accept": "application/json"},
        )
        token_resp.raise_for_status()
        # token_data: {"access_token": "gho_...", "token_type": "bearer", "scope": "read:user"}
        access_token = token_resp.json().get("access_token")

    if not access_token:
        raise HTTPException(status_code=400, detail="Failed to obtain access token")

    # Store the access token directly as an httponly cookie — never exposed to JavaScript.
    # Phase 2: swap for GitHub App User Tokens (short-lived, refreshable).
    redirect = RedirectResponse(url=chosen_redirect)
    redirect.set_cookie(
        key=SESSION_COOKIE,
        value=access_token,
        httponly=True,
        samesite="none",
        secure=True,
        max_age=_TOKEN_MAX_AGE,
    )
    redirect.delete_cookie(STATE_COOKIE)
    return redirect


@router.get("/me", response_model=UserProfile)
async def me(gh_access_token: str | None = Cookie(default=None)) -> UserProfile:
    if not gh_access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient() as http:
        try:
            resp = await http.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {gh_access_token}",
                    "Accept": "application/json",
                },
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError:
            raise HTTPException(status_code=401, detail="Not authenticated")

    data = resp.json()
    return UserProfile(login=data["login"], name=data.get("name"), avatar_url=data["avatar_url"])


@router.post("/logout", status_code=204)
async def logout(request: Request) -> Response:
    # Derive the set of allowed origins from the full redirect URLs by keeping only scheme+netloc.
    # e.g. "http://localhost:5173/inkwell/" → "http://localhost:5173"
    allowed_origins = {
        urllib.parse.urlparse(url).scheme + "://" + urllib.parse.urlparse(url).netloc
        for url in ALLOWED_REDIRECT_URLS
    }

    origin = request.headers.get("Origin")
    if not origin or origin not in allowed_origins:
        raise HTTPException(status_code=403, detail="Forbidden")

    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE, httponly=True, samesite="none", secure=True)
    response.delete_cookie(STATE_COOKIE, httponly=True, samesite="none", secure=True)
    return response
