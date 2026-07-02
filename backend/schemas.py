from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None


class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    oauth_provider: Optional[str] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LogOut(BaseModel):
    id: int
    prompt: str
    provider: str
    response: str
    createdAt: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_custom(cls, log):
        return cls(
            id=log.id,
            prompt=log.prompt,
            provider=log.provider,
            response=log.response,
            createdAt=log.created_at,
        )


class PromptRequest(BaseModel):
    prompt: str


class PullKincaidRequest(BaseModel):
    prompt: str


class PermissionOut(BaseModel):
    id: int
    user_id: str
    module: str
    can_view: bool
    can_edit: bool
    granted_by: Optional[str] = None

    class Config:
        from_attributes = True


class PermissionUpsert(BaseModel):
    username: str
    module: str
    can_view: bool = True
    can_edit: bool = False
