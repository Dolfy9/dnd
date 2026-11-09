#!/usr/bin/env python3
"""Kontrola relativních odkazů v Markdownu a (s --index) přegenerování obsahů v README."""
import re
import sys
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parent.parent
START, END = "<!-- INDEX -->", "<!-- /INDEX -->"
LINK = re.compile(r"\[[^\]]*\]\(([^)#\s]+)(?:#[^)]*)?\)")
SKIP = {"_import", ".git", "tools", "web"}


def md_files():
    return sorted(p for p in ROOT.rglob("*.md") if not SKIP & set(p.relative_to(ROOT).parts))


def title(p):
    for line in p.read_text(encoding="utf-8").splitlines():
        if line.startswith("# "):
            return line[2:].replace("Postava: ", "").strip()
    return p.stem


def entries(folder, base):
    out = []
    for p in sorted(folder.rglob("*.md")):
        if p.name == "README.md":
            continue
        out.append(f"- [{title(p)}]({p.relative_to(base).as_posix()})")
    return out


def write_index(readme, lines):
    text = readme.read_text(encoding="utf-8")
    if START not in text:
        return
    head = text.split(START)[0]
    tail = text.split(END, 1)[1] if END in text else "\n"
    body = "\n".join(lines) if lines else "_(zatím prázdné)_"
    readme.write_text(f"{head}{START}\n{body}\n{END}{tail}", encoding="utf-8")


def regenerate():
    root_lines = []
    for folder in sorted(d for d in ROOT.iterdir() if d.is_dir() and d.name[:2].isdigit()):
        root_lines.append(f"\n### [{folder.name}]({folder.name}/)")
        sub = sorted(d for d in folder.iterdir() if d.is_dir() and any(d.rglob("*.md")))
        if sub:
            for s in sub:
                root_lines.append(f"- **{s.name.replace('_', ' ')}**")
                root_lines += ["  " + e for e in entries(s, ROOT)]
            root_lines += [e for e in entries(folder, ROOT) if e.count("/") == 1]
        else:
            root_lines += entries(folder, ROOT) or ["_(zatím prázdné)_"]
        if (folder / "README.md").exists():
            write_index(folder / "README.md", entries(folder, folder))
    write_index(ROOT / "README.md", root_lines)


def check():
    broken = []
    files = md_files()
    for p in files:
        text = p.read_text(encoding="utf-8")
        if text.startswith("---\n"):
            end = text.find("\n---\n", 4)
            if end < 0:
                broken.append(f"{p.relative_to(ROOT)}: neuzavřený YAML front matter")
            else:
                try:
                    yaml.safe_load(text[4:end])
                except yaml.YAMLError as exc:
                    broken.append(f"{p.relative_to(ROOT)}: neplatný YAML front matter: {exc}")
        for target in LINK.findall(text):
            if re.match(r"^[a-z]+:", target):
                continue
            path = target.split("?", 1)[0]
            local = (ROOT / path.lstrip("/")) if path.startswith("/") else (p.parent / path)
            resolved = local.resolve()
            if resolved.exists():
                continue
            try:
                route = resolved.relative_to(ROOT).as_posix().rstrip("/")
            except ValueError:
                route = ""
            generated = ROOT / "web" / "docs" / (route + ".md") if route else None
            if not generated or not generated.is_file():
                broken.append(f"{p.relative_to(ROOT)} -> {target}")
    for b in broken:
        print("ROZBITÝ ODKAZ:", b)
    print(f"Zkontrolováno {len(files)} souborů, chyby: {len(broken)}")
    return not broken


if __name__ == "__main__":
    if "--index" in sys.argv:
        regenerate()
    sys.exit(0 if check() else 1)
