"""Zápis textového souboru do repa se zachováním konců řádků.

Detekuje převládající EOL v existujícím souboru (výchozí LF) a zapíše
bytes — na Windows tak nevzniká CRLF diff u souborů, které jsou v HEAD LF.
"""
from pathlib import Path


def detect_eol(p: Path) -> str:
    try:
        data = p.read_bytes()
    except OSError:
        return "\n"
    crlf = data.count(b"\r\n")
    lf = data.count(b"\n") - crlf
    return "\r\n" if crlf > lf else "\n"


def write_repo_text(path, text: str) -> None:
    p = Path(path)
    eol = detect_eol(p)
    text = text.replace("\r\n", "\n")
    if eol == "\r\n":
        text = text.replace("\n", "\r\n")
    p.write_bytes(text.encode("utf-8"))
