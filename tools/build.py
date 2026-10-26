#!/usr/bin/env python3
"""Builds index.html from index.template.html + app.logic.js. Run: python3 tools/build.py (from the repo root)."""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
html = (ROOT / "index.template.html").read_text().replace("/*LOGIC*/", (ROOT / "app.logic.js").read_text())
(ROOT / "index.html").write_text(html)
print("index.html built", len(html), "bytes")
