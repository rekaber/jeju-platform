# -*- coding: utf-8 -*-
"""
Split live index.html into css/ + js/ modules (GitHub Pages classic scripts).
Source of truth: current index.html contents.
"""
from pathlib import Path

ROOT = Path(r'C:\Jeju-Platform')
INDEX = ROOT / 'index.html'
text = INDEX.read_text(encoding='utf-8')
lines = text.splitlines(True)

def slice_lines(a, b):
    """1-based inclusive line slice."""
    return ''.join(lines[a - 1:b])

def write_js(name, content, header=None):
    path = ROOT / 'js' / name
    body = content if content.endswith('\n') else content + '\n'
    if header:
        body = header + '\n' + body
    else:
        body = f'/* js/{name} - extracted from index.html */\n' + body
    path.write_text(body, encoding='utf-8')
    print(f'  wrote js/{name} ({len(body)} bytes)')

(ROOT / 'css').mkdir(exist_ok=True)
(ROOT / 'js').mkdir(exist_ok=True)

# ── CSS ──────────────────────────────────────────────
style_css = '/* css/style.css - extracted from index.html */\n' + slice_lines(12, 746)
intro_css = '/* css/intro.css - extracted from index.html */\n' + slice_lines(747, 899)
(ROOT / 'css' / 'style.css').write_text(style_css, encoding='utf-8')
(ROOT / 'css' / 'intro.css').write_text(intro_css, encoding='utf-8')
print('CSS written')

# ── JS modules (line ranges from current index.html) ─
# intro
write_js('intro.js', slice_lines(1929, 1958))

# beopjeongdong + empty MULTI_DATA init
write_js('data-dong.js', slice_lines(1960, 2042))

# config: supabase keys + labels
config = '''/* js/config.js - extracted from index.html */
const SUPABASE_URL  = 'https://boukipzpoapqotvauzrj.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvdWtpcHpwb2FwcW90dmF1enJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2Mzk0MjcsImV4cCI6MjEwMzIxNTQyN30.-ZQTeIqeahNdmaSSoCFC5BggQtMVPxqXWE9x0khZKOg';

const TYPE_LABEL = { apt:'아파트', ofc:'오피스텔', villa:'빌라·타운하우스' };
const VWORLD_KEY = 'E7677C67-87D1-3D51-AE0C-C59B2947A413';
'''
(ROOT / 'js' / 'config.js').write_text(config, encoding='utf-8')
print('  wrote js/config.js')

# geo: cache + dong coords + geocode (2044-2201) + isInJeju
geo = slice_lines(2044, 2201) + '\n' + slice_lines(2661, 2664)
write_js('geo.js', geo)

# supabase fetch helper only (skip duplicate const SUPABASE_*)
sb = slice_lines(2207, 2233)  # async function sbFetchAll ...
# Prepend comment; constants come from config.js
write_js('supabase.js', sb, header='/* js/supabase.js - requires config.js */')

# load-trades: badges + loaders
write_js('load-trades.js', slice_lines(2235, 2636))

# unsold static data (without TYPE_LABEL / VWORLD / isInJeju)
write_js('unsold-data.js', slice_lines(2638, 2656))

# map init + type + panel
write_js('map.js', slice_lines(2666, 2725))

# data modal
write_js('data-modal.js', slice_lines(2727, 3046))

# reg zone (+ visitor chart section under same span)
write_js('reg-zone.js', slice_lines(3048, 3488))

# bid / arch / dev
write_js('bid.js', slice_lines(3490, 3692))
write_js('arch.js', slice_lines(3694, 3941))
write_js('dev.js', slice_lines(3943, 4283))

# bubble (trade + land bubbles)
write_js('bubble.js', slice_lines(4285, 4523))

# legacy multi trade helpers
write_js('trade.js', slice_lines(4525, 4696))

# per-type trade system + rank etc until stats
write_js('trade-layers.js', slice_lines(4698, 5479))

# stats modal
write_js('stats.js', slice_lines(5481, 5746))

# land layer
write_js('land.js', slice_lines(5748, 6031))

# unsold markers UI
write_js('unsold.js', slice_lines(6033, 6217))

# search
write_js('search.js', slice_lines(6219, 6312))

# toast + draggable + geocodeUnsold call
write_js('toast-ui.js', slice_lines(6314, 6394))

# migration / jiga / imde / land-stat
write_js('migration.js', slice_lines(6396, 6701))
write_js('jiga.js', slice_lines(6703, 6841))
write_js('imde.js', slice_lines(6843, 6951))
write_js('land-stat.js', slice_lines(6953, 7186))

# boot
write_js('boot.js', slice_lines(7188, 7189))

# ── Rebuild index.html ───────────────────────────────
# Keep everything before <style>, then links, then body until <script>, then script tags

head_end = None
for i, l in enumerate(lines):
    if l.strip() == '<style>':
        head_end = i  # exclusive end of pre-style
        break
assert head_end is not None

body_start = None
for i, l in enumerate(lines):
    if l.strip() == '</style>':
        # skip </style> and </head> if present
        body_start = i + 1
        break
assert body_start is not None

# find <body>
while body_start < len(lines) and lines[body_start].strip() in ('', '</head>'):
    body_start += 1

script_line = None
for i, l in enumerate(lines):
    if l.strip() == '<script>':
        script_line = i
        break
assert script_line is not None

# markup: from body_start to script_line (exclusive)
markup = ''.join(lines[body_start:script_line])

# Ensure we have </head> structure
pre = ''.join(lines[:head_end])
# pre currently ends before <style>; should include kakao script

SCRIPT_ORDER = [
    'config.js',
    'supabase.js',
    'data-dong.js',
    'geo.js',
    'intro.js',
    'unsold-data.js',
    'map.js',
    'load-trades.js',
    'data-modal.js',
    'reg-zone.js',
    'bid.js',
    'arch.js',
    'dev.js',
    'bubble.js',
    'trade.js',
    'trade-layers.js',
    'stats.js',
    'land.js',
    'unsold.js',
    'search.js',
    'toast-ui.js',
    'migration.js',
    'jiga.js',
    'imde.js',
    'land-stat.js',
    'boot.js',
]

script_tags = '\n'.join(f'<script src="./js/{n}"></script>' for n in SCRIPT_ORDER)

new_html = (
    pre
    + '<link rel="stylesheet" href="./css/style.css">\n'
    + '<link rel="stylesheet" href="./css/intro.css">\n'
    + '</head>\n'
    + markup
    + '\n'
    + script_tags
    + '\n</body>\n</html>\n'
)

# If markup already starts with <body>, good. If pre already closed head incorrectly, fix.
# pre may not include </head> — we add it after links.
# If markup starts with <body>, OK. If pre had no </head>, we inserted one.

INDEX.write_text(new_html, encoding='utf-8')
print('Rewrote index.html', len(new_html), 'chars', 'lines', new_html.count(chr(10))+1)

# sanity: no inline style/script left
assert '<style>' not in new_html
assert '<script>' not in new_html  # only src= scripts
assert 'load-trades' in new_html
print('OK')
