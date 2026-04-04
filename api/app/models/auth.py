from pydantic import BaseModel


class UserProfile(BaseModel):
    login: str
    name: str | None
    avatar_url: str


class SessionData(BaseModel):
    access_token: str
    login: str
    name: str | None
    avatar_url: str


class CookiePayload(BaseModel):
    session_id: str
    login: str
    name: str | None
    avatar_url: str
