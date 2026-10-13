#!/usr/bin/env python3
"""
Extracts the French user-facing texts of the dashboard into public/i18n/source.json.
Run it after changing texts, then add the missing translations to public/i18n/<lang>.json.
Usage: python3 scripts/i18n-extract.py
"""
import json, re, os
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORD = re.compile(r"[A-Za-zÀ-ÿ]{2,}")
CODE_LIKE = re.compile(r"(^[\w.-]+\.(js|css|png|html|json)$|https?://|^#[\w-]+$|^[.#]?[a-z-]+:[a-z-]|=>|\bfunction\b|\bconst\b|\breturn\b|;\s*$|^\w+\(|[{}<>]|^--|^[a-z]+[A-Z]\w*$|^[a-z_]+$|^[A-Z_]{3,}$|^fa[sbr]? fa-|\$\{)")

def norm(t):
    return " ".join(t.split())

NOISE = re.compile(r"(^[#./?&)(\[]|/api/|\bpx\b|\bsolid\b|rgba?\(|localhost|\.join\(|\.(png|jpg|gif|webp|mp3|js|css)\b|^[\w-]+=|&\w+=|\b(var|let|null|undefined|true|false)\b|^\w+_\w+$|^[A-Z][a-z]+[A-Z]\w+$)")

def looks_french_ui(t):
    t = norm(t)
    if len(t) < 2 or not WORD.search(t):
        return False
    if CODE_LIKE.search(t) or NOISE.search(t):
        return False
    # A real UI text has a space, an accent, a capital letter or punctuation
    return bool(re.search(r"[ À-ÿ]|^[A-ZÀ-Ý]|[!?.:…]", t))

texts = set()
patterns = set()

class Collector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
        for k, v in attrs:
            if k in ("placeholder", "title", "aria-label", "alt", "data-tooltip") and v and looks_french_ui(v):
                texts.add(norm(v))
    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip -= 1
    def handle_data(self, d):
        if not self.skip and looks_french_ui(d):
            texts.add(norm(d))

def collect_html_fragment(fragment):
    c = Collector()
    try:
        c.feed(fragment)
    except Exception:
        pass

for page in ["index.html", "launcher.html", "download.html", "payment.html"]:
    p = os.path.join(ROOT, "public", page)
    if os.path.exists(p):
        collect_html_fragment(open(p, encoding="utf-8").read())

# ---- JavaScript string literals (dashboard) ----
JS_STRING = re.compile(r"`((?:\\.|[^`\\])*)`|'((?:\\.|[^'\\\n])*)'|\"((?:\\.|[^\"\\\n])*)\"", re.S)
CONSOLE = re.compile(r"console\.(log|warn|error|info|debug)\s*\($")

def handle_js_literal(raw, is_template):
    raw = raw.replace("\\'", "'").replace('\\"', '"').replace("\\n", " ")
    if is_template and "${" in raw:
        # Replace interpolations by placeholders, then split on HTML tags
        idx = [0]
        def ph(m):
            i = idx[0]; idx[0] += 1
            return "{%d}" % i
        # nested braces are rare in UI templates: handle one level
        templ = re.sub(r"\$\{(?:[^{}]|\{[^{}]*\})*\}", ph, raw)
        for piece in re.split(r"<[^>]+>", templ):
            piece = norm(piece)
            if not piece:
                continue
            if re.fullmatch(r"(\{\d+\}\s*)+", piece):
                continue
            stripped = re.sub(r"\{\d+\}", "", piece)
            if not looks_french_ui(stripped) or NOISE.search(piece) or "/" in piece.split(" ")[0]:
                continue
            if re.search(r"\{\d+\}", piece):
                # renumber placeholders from 0 in this piece
                n = [0]
                def renum(m):
                    k = n[0]; n[0] += 1
                    return "{%d}" % k
                patterns.add(re.sub(r"\{\d+\}", renum, piece))
            else:
                texts.add(piece)
    elif "<" in raw and ">" in raw:
        collect_html_fragment(raw)
    elif looks_french_ui(raw):
        texts.add(norm(raw))

for js in ["public/app.js", "public/home.js", "public/router.js", "public/pro.js", "public/gallery.js", "public/appstatus.js", "public/premium.js", "public/donors.js", "public/runmode.js", "public/navrail.js"]:
    p = os.path.join(ROOT, js)
    src = open(p, encoding="utf-8").read()
    # drop comments
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    src = re.sub(r"(?m)^\s*//.*$", "", src)
    for m in JS_STRING.finditer(src):
        before = src[max(0, m.start() - 40):m.start()].rstrip()
        if CONSOLE.search(before) or before.endswith("querySelector(") or before.endswith("getElementById("):
            continue
        if m.group(1) is not None:
            handle_js_literal(m.group(1), True)
        else:
            handle_js_literal(m.group(2) if m.group(2) is not None else m.group(3), False)

# Explicit t('...') calls are always UI texts, even short ones the heuristics would drop
T_CALL = re.compile(r"\bt\((['\"])((?:\\.|(?!\1).)*)\1\)")
for js in ["public/app.js", "public/pro.js", "public/gallery.js", "public/appstatus.js", "public/premium.js", "public/donors.js", "public/runmode.js", "public/navrail.js"]:
    for m in T_CALL.finditer(open(os.path.join(ROOT, js), encoding="utf-8").read()):
        txt = norm(m.group(2).replace("\\'", "'"))
        if txt and WORD.search(txt):
            texts.add(txt)

# ---- Server messages shown in the dashboard (notifications / API errors) ----
SERVER_MSG = re.compile(r"(?:error|message|title|details)\s*:\s*(['\"`])((?:\\.|(?!\1).)*)\1")
for dirpath, _, files in os.walk(os.path.join(ROOT, "src")):
    for f in files:
        if f.endswith(".js"):
            src = open(os.path.join(dirpath, f), encoding="utf-8").read()
            for m in SERVER_MSG.finditer(src):
                handle_js_literal(m.group(2), m.group(1) == "`")

# Remove things that are not French UI text (brand names, units, identifiers)
IGNORE = {"Gentok", "TikTok", "Spotify", "Minecraft", "OBS", "Discord", "Stripe", "Webhook", "ServerTap", "Gentok Pro", "Premium", "PRO", "VIP", "MOD", "SUB", "TTS", "URL", "OK", "ID", "Live"}
texts = {t for t in texts if t not in IGNORE and not re.fullmatch(r"[\d\s.,:%/x×+\-]+", t)}

out = {"texts": sorted(texts), "patterns": sorted(patterns)}
os.makedirs(os.path.join(ROOT, "public", "i18n"), exist_ok=True)
with open(os.path.join(ROOT, "public", "i18n", "source.json"), "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False, indent=1)
print(f"{len(texts)} textes, {len(patterns)} modèles -> public/i18n/source.json")
