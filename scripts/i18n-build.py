#!/usr/bin/env python3
"""
Builds public/i18n/<lang>.js (loaded by public/i18n.js) from public/i18n/<lang>.json.
<lang>.json format: {"texts": {"Texte français": "Translation", ...}, "patterns": {"Bonjour {0}": "Hello {0}", ...}}
Also reports the texts of public/i18n/source.json that are not translated yet.
Usage: python3 scripts/i18n-build.py
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
I18N = os.path.join(ROOT, "public", "i18n")
source = json.load(open(os.path.join(I18N, "source.json"), encoding="utf-8"))

for name in sorted(os.listdir(I18N)):
    m = re.fullmatch(r"([a-z]{2})\.json", name)
    if not m:
        continue
    lang = m.group(1)
    data = json.load(open(os.path.join(I18N, name), encoding="utf-8"))
    texts = {k: v for k, v in data.get("texts", {}).items() if v}
    patterns = {}
    for k, v in data.get("patterns", {}).items():
        if not v:
            continue
        if sorted(re.findall(r"\{\d+\}", k)) != sorted(re.findall(r"\{\d+\}", v)):
            print(f"[{lang}] placeholders différents, ignoré : {k!r} -> {v!r}")
            continue
        patterns[k] = v
    js = "window.__gentokRegisterDictionary(" + json.dumps({"texts": texts, "patterns": patterns}, ensure_ascii=False, separators=(",", ":")) + ");\n"
    open(os.path.join(I18N, f"{lang}.js"), "w", encoding="utf-8").write(js)
    missing = [t for t in source["texts"] if t not in texts] + [p for p in source["patterns"] if p not in patterns]
    total = len(source["texts"]) + len(source["patterns"])
    print(f"{lang}: {total - len(missing)}/{total} traduits ({len(missing)} manquants) -> public/i18n/{lang}.js")
