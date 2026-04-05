import os
import secrets
import time
import urllib.parse

import httpx
import jwt
from fastapi import APIRouter, Cookie, HTTPException, Response
from fastapi.responses import RedirectResponse

from app.models.auth import JWTPayload, UserProfile

# TODO: Add a ASCII Architecture diagram of how these resources work

# TODO: Create a separate ENV/Config module where all environment variables are loaded and validated. This way we can reuse the config in tests and have a single source of truth for required env vars. For now, we just load them at module level and fail fast if any are missing.
_REQUIRED_ENV = [
    "OAUTH_CLIENT_ID",
    "OAUTH_CLIENT_SECRET",
    "OAUTH_CALLBACK_URL",
    "SESSION_SECRET",
    "FRONTEND_URL",
]

# TODO: Reuse these cookie names in tests, I see duplications there...
SESSION_COOKIE = "inkwell_session"
STATE_COOKIE = "gh_oauth_state"

# TODO: Document why these values
_JWT_ALGORITHM = "HS256"
_SESSION_TTL = 86400  # 24 hours


# Read config once at module load — fail fast if env vars are missing
def _load_config() -> tuple[str, str, str, str, str]:
    for v in _REQUIRED_ENV:
        if not os.environ.get(v):
            raise RuntimeError(f"Missing required environment variable: {v}")
    return (
        os.environ["OAUTH_CLIENT_ID"],
        os.environ["OAUTH_CLIENT_SECRET"],
        os.environ["OAUTH_CALLBACK_URL"],
        # TODO: Since we're using JWTs, we don't actually need a session secret — we just need a signing key. Maybe rename this to JWT_SIGNING_KEY or something? Or even better, switch to asymmetric keys and call it JWT_PRIVATE_KEY or something like that.
        os.environ["SESSION_SECRET"],
        os.environ["FRONTEND_URL"],
    )


_OAUTH_CLIENT_ID, _OAUTH_CLIENT_SECRET, _OAUTH_CALLBACK_URL, _SESSION_SECRET, _FRONTEND_URL = _load_config()

router = APIRouter(tags=["auth"])


def _encode_jwt(login: str, name: str | None, avatar_url: str) -> str:
    """Encode a signed JWT containing the user profile. The GitHub access token
    is never included — it is discarded after fetching the profile in /callback."""
    payload = {
        "login": login,
        "name": name,
        "avatar_url": avatar_url,
        "exp": int(time.time()) + _SESSION_TTL,
    }
    return jwt.encode(payload, _SESSION_SECRET, algorithm=_JWT_ALGORITHM)


def _decode_jwt(token: str) -> JWTPayload:
    try:
        data = jwt.decode(token, _SESSION_SECRET, algorithms=[_JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Session expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid session") from exc
    return JWTPayload.model_validate(data)


@router.get("/login")
def login() -> RedirectResponse:
    state = secrets.token_urlsafe(32)
    params = urllib.parse.urlencode(
        # TODO: Document each parameter and why it's needed. Also, figure out if we can pass the UI url to GitHub in some way so we don't have to set it in env vars on the backend.
        {
            "client_id": _OAUTH_CLIENT_ID,
            "redirect_uri": _OAUTH_CALLBACK_URL,
            "scope": "read:user",
            "state": state,
        }
    )
    # TODO: What is this redirect eventually?
    redirect = RedirectResponse(url=f"https://github.com/login/oauth/authorize?{params}")
    redirect.set_cookie(
        key=STATE_COOKIE,
        value=state,
        httponly=True,
        samesite="none",
        secure=True,
        max_age=600,
    )
    return redirect


# Document each param and overall flow in this callback. It's a bit complex and it's not clear at first glance why we need each part.
@router.get("/callback")
async def callback(
    code: str,
    state: str,
    gh_oauth_state: str | None = Cookie(default=None),
) -> RedirectResponse:
    if not gh_oauth_state or state != gh_oauth_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    async with httpx.AsyncClient() as http:
        token_resp = await http.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": _OAUTH_CLIENT_ID,
                "client_secret": _OAUTH_CLIENT_SECRET,
                "code": code,
                "redirect_uri": _OAUTH_CALLBACK_URL,
            },
            headers={"Accept": "application/json"},
        )
        token_resp.raise_for_status()
        token_data = token_resp.json()

        # TODO: What is inside token_data?
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to obtain access token")

        # TODO: I think overall picture, we don't need to put any user data into JWT...
        # ... we have /me route already
        # Just settle access_token as a cookie HTTP-only and that's it.
        # That way we don't need about JWT or session at all
        user_resp = await http.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        user_resp.raise_for_status()
        user_data = user_resp.json()

    # access_token is discarded here — only the profile goes into the JWT
    session_token = _encode_jwt(
        login=user_data["login"],
        name=user_data.get("name"),
        avatar_url=user_data["avatar_url"],
    )

    redirect = RedirectResponse(url=_FRONTEND_URL)
    redirect.set_cookie(
        key=SESSION_COOKIE,
        value=session_token,
        httponly=True,
        samesite="none",
        secure=True,
        max_age=_SESSION_TTL,
    )
    redirect.delete_cookie(STATE_COOKIE)
    return redirect


@router.get("/me", response_model=UserProfile)
def me(inkwell_session: str | None = Cookie(default=None)) -> UserProfile:
    if not inkwell_session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = _decode_jwt(inkwell_session)
    return UserProfile(login=payload.login, name=payload.name, avatar_url=payload.avatar_url)


# TODO: Not sure how refresh will work if we switch to just storing access_token in cookie. Is there a way to refresh GitHub access tokens?
@router.get("/refresh", response_model=UserProfile)
def refresh(
    response: Response,
    inkwell_session: str | None = Cookie(default=None),
) -> UserProfile:
    if not inkwell_session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = _decode_jwt(inkwell_session)
    new_token = _encode_jwt(login=payload.login, name=payload.name, avatar_url=payload.avatar_url)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=new_token,
        httponly=True,
        samesite="none",
        secure=True,
        max_age=_SESSION_TTL,
    )
    return UserProfile(login=payload.login, name=payload.name, avatar_url=payload.avatar_url)
