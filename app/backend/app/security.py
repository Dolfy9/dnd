"""Autentizace a autorizace: argon2 hesla, session cookie, CSRF, role.

Role: player < editor < admin (DM). Závislosti pro FastAPI routery:
  user()          – přihlášený uživatel nebo 401
  require(role)   – minimální role, jinak 403
Pro čtení (GET) se CSRF nekontroluje, pro mutace se požaduje hlavička X-CSRF.
"""
import secrets
import time
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, Request, Response

from . import db
from .config import COOKIE_NAME, COOKIE_SECURE, SESSION_DAYS

_ph = PasswordHasher()
ROLE_LEVEL = {"player": 0, "editor": 1, "admin": 2}


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def create_session(user_id: int) -> tuple[str, str]:
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(16)
    con = db.connect()
    con.execute("INSERT INTO sessions(token,user_id,csrf,expires) VALUES(?,?,?,?)",
                (token, user_id, csrf, time.time() + SESSION_DAYS * 86400))
    con.execute("DELETE FROM sessions WHERE expires < ?", (time.time(),))
    con.commit()
    return token, csrf


def drop_session(token: str) -> None:
    con = db.connect()
    con.execute("DELETE FROM sessions WHERE token=?", (token,))
    con.commit()


def get_user(token: str | None) -> Optional[dict]:
    if not token:
        return None
    con = db.connect()
    row = con.execute(
        "SELECT u.id,u.login,u.name,u.role,s.csrf FROM sessions s JOIN users u ON u.id=s.user_id "
        "WHERE s.token=? AND s.expires>? AND u.disabled=0", (token, time.time())).fetchone()
    return dict(row) if row else None


def current(request: Request) -> Optional[dict]:
    return get_user(request.cookies.get(COOKIE_NAME))


def _check_csrf(request: Request, u: dict) -> None:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    if request.headers.get("x-csrf") != u.get("csrf"):
        raise HTTPException(403, "neplatný CSRF token")


def user(request: Request) -> dict:
    u = current(request)
    if not u:
        raise HTTPException(401, "Nepřihlášený uživatel")
    _check_csrf(request, u)
    return u


def optional(request: Request) -> Optional[dict]:
    u = current(request)
    if u:
        _check_csrf(request, u)
    return u


def require(role: str):
    """Dependency: vyžaduje alespoň danou roli."""
    need = ROLE_LEVEL[role]

    def dep(u: dict = Depends(user)) -> dict:
        if ROLE_LEVEL.get(u["role"], -1) < need:
            raise HTTPException(403, "Nedostatečná oprávnění")
        return u
    return dep


def set_cookie(response: Response, token: str) -> None:
    response.set_cookie(COOKIE_NAME, token, max_age=SESSION_DAYS * 86400,
                        httponly=True, samesite="lax", secure=COOKIE_SECURE)


def clear_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME)


def can_see(u: Optional[dict], secret: bool) -> bool:
    """Může uživatel vidět tajný obsah?"""
    if not secret:
        return True
    return bool(u) and ROLE_LEVEL.get(u["role"], -1) >= ROLE_LEVEL["editor"]


def can_edit(u: Optional[dict]) -> bool:
    return bool(u) and ROLE_LEVEL.get(u["role"], -1) >= ROLE_LEVEL["editor"]
