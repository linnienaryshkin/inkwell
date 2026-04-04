import json
import os
import secrets
import urllib.parse

import httpx
from fastapi import APIRouter, Cookie, HTTPException, Response
from fastapi.responses import RedirectResponse
from itsdangerous import BadSignature, SignatureExpired, TimestampSigner

from app.models.auth import CookiePayload, SessionData, UserProfile

_REQUIRED_ENV = ["OAUTH_CLIENT_ID", "OAUTH_CLIENT_SECRET", "OAUTH_CALLBACK_URL", "SESSION_SECRET"]

SESSION_COOKIE = "inkwell_session"
STATE_COOKIE = "gh_oauth_state"


# Read config once at module load — fail fast if env vars are missing
def _load_config() -> tuple[str, str, str, str]:
    missing = [v for v in _REQUIRED_ENV if not os.environ.get(v)]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")
    return (
        os.environ["OAUTH_CLIENT_ID"],
        os.environ["OAUTH_CLIENT_SECRET"],
        os.environ["OAUTH_CALLBACK_URL"],
        os.environ["SESSION_SECRET"],
    )


_CLIENT_ID, _CLIENT_SECRET, _CALLBACK_URL, _SESSION_SECRET = _load_config()

# Maps session_id → access_token (server-side, never exposed in the cookie)
_session_store: dict[str, str] = {}

router = APIRouter(tags=["auth"])


def _sign_session(data: SessionData) -> str:
    """Sign a CookiePayload derived from SessionData. The access_token is stored
    server-side in _session_store and never placed in the cookie."""
    session_id = secrets.token_urlsafe(32)
    _session_store[session_id] = data.access_token
    payload = CookiePayload(
        session_id=session_id,
        login=data.login,
        name=data.name,
        avatar_url=data.avatar_url,
    )
    signer = TimestampSigner(_SESSION_SECRET)
    return signer.sign(json.dumps(payload.model_dump())).decode()


def _unsign_session(token: str, max_age: int = 86400) -> CookiePayload:
    signer = TimestampSigner(_SESSION_SECRET)
    try:
        raw = signer.unsign(token.encode(), max_age=max_age).decode()
    except SignatureExpired as exc:
        raise HTTPException(status_code=401, detail="Session expired") from exc
    except BadSignature as exc:
        raise HTTPException(status_code=401, detail="Invalid session") from exc
    return CookiePayload.model_validate(json.loads(raw))


@router.get("/login")
def login() -> RedirectResponse:
    state = secrets.token_urlsafe(32)
    params = urllib.parse.urlencode(
        {
            "client_id": _CLIENT_ID,
            "redirect_uri": _CALLBACK_URL,
            "scope": "read:user",
            "state": state,
        }
    )
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
                "client_id": _CLIENT_ID,
                "client_secret": _CLIENT_SECRET,
                "code": code,
                "redirect_uri": _CALLBACK_URL,
            },
            headers={"Accept": "application/json"},
        )
        token_resp.raise_for_status()
        token_data = token_resp.json()

        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to obtain access token")

        user_resp = await http.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        user_resp.raise_for_status()
        user_data = user_resp.json()

    session = SessionData(
        access_token=access_token,
        login=user_data["login"],
        name=user_data.get("name"),
        avatar_url=user_data["avatar_url"],
    )
    session_token = _sign_session(session)

    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173/inkwell/")
    redirect = RedirectResponse(url=frontend_url)
    redirect.set_cookie(
        key=SESSION_COOKIE,
        value=session_token,
        httponly=True,
        samesite="none",
        secure=True,
        max_age=86400,
    )
    redirect.delete_cookie(STATE_COOKIE)
    return redirect


@router.get("/me", response_model=UserProfile)
def me(inkwell_session: str | None = Cookie(default=None)) -> UserProfile:
    if not inkwell_session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = _unsign_session(inkwell_session)
    return UserProfile(login=session.login, name=session.name, avatar_url=session.avatar_url)


@router.get("/refresh", response_model=UserProfile)
def refresh(
    response: Response,
    inkwell_session: str | None = Cookie(default=None),
) -> UserProfile:
    if not inkwell_session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = _unsign_session(inkwell_session)
    # Re-sign: look up the stored access_token so _sign_session can store it under the new session_id
    access_token = _session_store.get(payload.session_id, "")
    new_session = SessionData(
        access_token=access_token,
        login=payload.login,
        name=payload.name,
        avatar_url=payload.avatar_url,
    )
    new_token = _sign_session(new_session)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=new_token,
        httponly=True,
        samesite="none",
        secure=True,
        max_age=86400,
    )
    return UserProfile(login=payload.login, name=payload.name, avatar_url=payload.avatar_url)
