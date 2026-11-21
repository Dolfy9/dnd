"""Bezpečný vyhodnocovač výrazů v efektech (žádný eval).

Podporované tokeny:
  celá čísla, PB, uroven (úroveň postavy), uroven:<Class> (úroveň ve třídě),
  mod:<AB> (modifikátor atributu), + - * / (celočíselné dělení dolů),
  max(a, b, …), min(a, b, …), závorky.
Příklady: "PB", "uroven:Barbarian", "5*uroven:Paladin", "max(1, mod:CHA)".
"""
import re

_TOKEN = re.compile(r"""
    \s*(?:
        (?P<num>\d+)
      | (?P<fnc>max|min)\b
      | (?P<var>PB|uroven:[A-Za-z][A-Za-z .'’\-]*/[0-9]+|uroven:[A-Za-z][A-Za-z .'’\-]*|uroven|walk|naladene|mod:[A-Za-z]{3})
      | (?P<op>[+\-*/(),])
    )
""", re.X)


class VýrazChyba(ValueError):
    pass


def _tokenize(text: str) -> list[tuple[str, str]]:
    out, pos = [], 0
    while pos < len(text):
        m = _TOKEN.match(text, pos)
        if not m or m.end() == pos:
            raise VýrazChyba(f"neplatný token na pozici {pos}: {text[pos:pos+10]!r}")
        pos = m.end()
        if m.group("num") is not None:
            out.append(("num", m.group("num")))
        elif m.group("fnc") is not None:
            out.append(("fnc", m.group("fnc")))
        elif m.group("var") is not None:
            out.append(("var", m.group("var").rstrip()))
        elif m.group("op") is not None:
            out.append(("op", m.group("op")))
    return out


class _Parser:
    def __init__(self, tokens, ctx):
        self.t = tokens
        self.i = 0
        self.ctx = ctx

    def _peek(self):
        return self.t[self.i] if self.i < len(self.t) else (None, None)

    def _eat(self, kind=None, val=None):
        tok = self._peek()
        if kind and tok[0] != kind:
            raise VýrazChyba(f"očekáván {kind}, je {tok}")
        if val and tok[1] != val:
            raise VýrazChyba(f"očekáván {val}, je {tok}")
        self.i += 1
        return tok

    def expr(self) -> int:
        v = self.term()
        while self._peek() == ("op", "+") or self._peek() == ("op", "-"):
            op = self._eat("op")[1]
            rhs = self.term()
            v = v + rhs if op == "+" else v - rhs
        return v

    def term(self) -> int:
        v = self.factor()
        while self._peek() == ("op", "*") or self._peek() == ("op", "/"):
            op = self._eat("op")[1]
            rhs = self.factor()
            if op == "*":
                v = v * rhs
            else:
                if rhs == 0:
                    raise VýrazChyba("dělení nulou")
                v = int(v / rhs)  # dělení vždy dolů (pravidla D&D)
        return v

    def factor(self) -> int:
        kind, val = self._peek()
        if kind == "num":
            self._eat()
            return int(val)
        if kind == "var":
            self._eat()
            return self._var(val)
        if kind == "fnc":
            self._eat()
            self._eat("op", "(")
            args = [self.expr()]
            while self._peek() == ("op", ","):
                self._eat()
                args.append(self.expr())
            self._eat("op", ")")
            return max(args) if val == "max" else min(args)
        if kind == "op" and val == "(":
            self._eat()
            v = self.expr()
            self._eat("op", ")")
            return v
        if kind == "op" and val == "-":
            self._eat()
            return -self.factor()
        if kind == "op" and val == "+":
            self._eat()
            return self.factor()
        raise VýrazChyba(f"neočekávaný token {kind}={val}")

    def _var(self, name: str) -> int:
        if name == "PB":
            return int(self.ctx.get("pb") or 0)
        if name == "walk":
            return int(self.ctx.get("walk") or 0)
        if name == "naladene":
            return int(self.ctx.get("naladene") or 0)
        if name == "uroven":
            return int(self.ctx.get("uroven") or 0)
        if name.startswith("mod:"):
            return int((self.ctx.get("mods") or {}).get(name[4:].upper(), 0))
        if name.startswith("uroven:"):
            rest = name[7:].strip()
            if "/" in rest:  # uroven:Trida/N → 1, když úroveň ve třídě ≥ N
                trida, prah = rest.rsplit("/", 1)
                lvl = int(self.ctx.get("uroven_v", lambda x: 0)(trida.strip()))
                return 1 if lvl >= int(prah) else 0
            return int(self.ctx.get("uroven_v", lambda x: 0)(rest))
        raise VýrazChyba(f"neznámá proměnná {name}")


def vyhodnot(value, ctx: dict) -> int:
    """Vyhodnotí číslo nebo výraz; čísla procházejí přímo."""
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    text = str(value or "").strip()
    if not text:
        return 0
    try:
        return int(text)
    except ValueError:
        pass
    p = _Parser(_tokenize(text), ctx)
    v = p.expr()
    if p.i != len(p.t):
        raise VýrazChyba(f"zbylé tokeny po výrazu: {text!r}")
    return v
