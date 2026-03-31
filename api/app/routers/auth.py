import json
import os
import secrets
import urllib.parse

import httpx
from fastapi import APIRouter, Cookie, HTTPException, Response
from fastapi.responses import RedirectResponse
from itsdangerous import BadSignature, SignatureExpired, TimestampSigner

from app.models.auth import SessionData, UserProfile

_REQUIRED_ENV = ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GITHUB_CALLBACK_URL", "SESSION_SECRET"]

SESSION_COOKIE = "inkwell_session"
STATE_COOKIE = "gh_oauth_state"

router = APIRouter(tags=["auth"])


def _get_config() -> tuple[str, str, str, str, bool]:
    missing = [v for v in _REQUIRED_ENV if not os.environ.get(v)]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")
    secure = os.environ.get("ENVIRONMENT", "production") != "development"
    return (
        os.environ["GITHUB_CLIENT_ID"],
        os.environ["GITHUB_CLIENT_SECRET"],
        os.environ["GITHUB_CALLBACK_URL"],
        os.environ["SESSION_SECRET"],
        secure,
    )


def _sign_session(data: SessionData) -> str:
    _, _, _, secret, _ = _get_config()
    signer = TimestampSigner(secret)
    payload = json.dumps(data.model_dump())
    return signer.sign(payload).decode()


def _unsign_session(token: str, max_age: int = 86400) -> SessionData:
    _, _, _, secret, _ = _get_config()
    signer = TimestampSigner(secret)
    try:
        payload = signer.unsign(token.encode(), max_age=max_age).decode()
    except SignatureExpired as exc:
        raise HTTPException(status_code=401, detail="Session expired") from exc
    except BadSignature as exc:
        raise HTTPException(status_code=401, detail="Invalid session") from exc
    return SessionData.model_validate(json.loads(payload))


@router.get("/login")
def login() -> RedirectResponse:
    client_id, _, callback_url, _, secure = _get_config()
    state = secrets.token_urlsafe(32)
    params = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "redirect_uri": callback_url,
            "scope": "read:user",
            "state": state,
        }
    )
    redirect = RedirectResponse(url=f"https://github.com/login/oauth/authorize?{params}")
    redirect.set_cookie(
        key=STATE_COOKIE,
        value=state,
        httponly=True,
        samesite="lax",
        secure=secure,
        max_age=600,
    )
    return redirect


@router.get("/callback")
async def callback(
    code: str,
    state: str,
    gh_oauth_state: str | None = Cookie(default=None),
) -> RedirectResponse:
    client_id, client_secret, callback_url, _, secure = _get_config()

    if not gh_oauth_state or state != gh_oauth_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    async with httpx.AsyncClient() as http:
        token_resp = await http.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": callback_url,
            },
            headers={"Accept": "application/json"},
        )
        token_resp.raise_for_status()
        token_data = token_resp.json()

    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Failed to obtain access token")

    async with httpx.AsyncClient() as http:
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

    redirect = RedirectResponse(url="/")
    redirect.set_cookie(
        key=SESSION_COOKIE,
        value=session_token,
        httponly=True,
        samesite="lax",
        secure=secure,
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
    _, _, _, _, secure = _get_config()
    session = _unsign_session(inkwell_session)
    new_token = _sign_session(session)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=new_token,
        httponly=True,
        samesite="lax",
        secure=secure,
        max_age=86400,
    )
    return UserProfile(login=session.login, name=session.name, avatar_url=session.avatar_url)
