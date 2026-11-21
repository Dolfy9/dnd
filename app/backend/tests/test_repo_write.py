"""Zápis do repa zachovává konce řádků existujícího souboru."""
from app.repo_write import write_repo_text, detect_eol


def test_lf_file_stays_lf(tmp_path):
    p = tmp_path / "Postava_X.md"
    p.write_bytes("a\nb\nc\n".encode())
    write_repo_text(p, "a\nb\nd\n")
    data = p.read_bytes()
    assert b"\r\n" not in data and data == b"a\nb\nd\n"


def test_crlf_file_stays_crlf(tmp_path):
    p = tmp_path / "x.md"
    p.write_bytes("a\r\nb\r\n".encode())
    write_repo_text(p, "a\nb\nc\n")
    assert p.read_bytes() == b"a\r\nb\r\nc\r\n"


def test_new_file_defaults_lf(tmp_path):
    p = tmp_path / "n.md"
    write_repo_text(p, "a\nb\n")
    assert b"\r\n" not in p.read_bytes()


def test_incoming_crlf_normalized_to_file_eol(tmp_path):
    p = tmp_path / "m.md"
    p.write_bytes("x\ny\n".encode())
    write_repo_text(p, "x\r\ny\r\n")
    assert p.read_bytes() == b"x\ny\n"
