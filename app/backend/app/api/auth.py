"""Login / logout / me."""
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from .. import db, security
from ..config import COOKIE_NAME

router = APIRouter(prefix="/api/auth", tags=["auth"])

_attempts: dict[str, list[float]] = {}


def _rate_limit(ip: str) -> None:
    now = time.time()
    tries = [t for t in _attempts.get(ip, []) if now - t < 300]
    if len(tries) >= 10:
        raise HTTPException(429, "Příliš mnoho pokusů o přihlášení – zkus to za pár minut.")
    tries.append(now)
    _attempts[ip] = tries


class LoginBody(BaseModel):
    login: str
    password: str


@router.post("/login")
def login(body: LoginBody, request: Request, response: Response):
    ip = request.client.host if request.client else "?"
    _rate_limit(ip)
    row = db.connect().execute(
        "SELECT id,pass_hash,role,disabled FROM users WHERE login=?", (body.login.strip().lower(),)).fetchone()
    if not row or row["disabled"] or not security.verify_password(body.password, row["pass_hash"]):
        raise HTTPException(401, "Neplatné přihlašovací údaje")
    token, csrf = security.create_session(row["id"])
    security.set_cookie(response, token)
    db.audit(body.login, "login")
    me = db.connect().execute("SELECT id,login,name,role FROM users WHERE id=?", (row["id"],)).fetchone()
    return {"ok": True, "csrf": csrf, "user": dict(me)}


@router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        security.drop_session(token)
    security.clear_cookie(response)
    return {"ok": True}


@router.get("/me")
def me(u: dict | None = Depends(security.optional)):
    return {"user": u and {"id": u["id"], "login": u["login"], "name": u["name"], "role": u["role"]},
            "csrf": u and u["csrf"]}
