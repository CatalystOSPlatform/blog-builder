#!/usr/bin/env python3
"""Builds index.html from index.template.html + app.logic.js. Run: python3 tools/build.py (from the repo root).
The figure card (an image or chart in the article) is written once in the template, between <!--FIGCARD--> and
<!--/FIGCARD-->, and placed wherever <!--FIGS listName--> appears (the introduction, each section, the conclusion)."""
import pathlib, re
ROOT = pathlib.Path(__file__).resolve().parent.parent
tpl = (ROOT / "index.template.html").read_text()
m = re.search(r"<!--FIGCARD-->\n(.*?)<!--/FIGCARD-->\n", tpl, re.S)
if m:
    card = m.group(1); tpl = tpl.replace(m.group(0), "")
    tpl = re.sub(r"<!--FIGS ([\w.]+)-->\n", lambda x: card.replace("{{ LIST }}", "{{ " + x.group(1) + " }}"), tpl)
html = tpl.replace("/*LOGIC*/", (ROOT / "app.logic.js").read_text())
(ROOT / "index.html").write_text(html)
print("index.html built", len(html), "bytes")
