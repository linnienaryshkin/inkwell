from pydantic import BaseModel

# TODO: Add documentation to the models and their fields

class UserProfile(BaseModel):
    login: str
    name: str | None
    avatar_url: str


class JWTPayload(BaseModel):
    login: str
    name: str | None
    avatar_url: str
    exp: int
