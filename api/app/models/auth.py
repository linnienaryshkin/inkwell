from pydantic import BaseModel


class UserProfile(BaseModel):
    """Public user profile returned by /auth/me. Sourced live from the GitHub API."""

    login: str
    name: str | None
    avatar_url: str
