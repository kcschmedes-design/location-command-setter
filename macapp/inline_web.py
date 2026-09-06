import re
from pathlib import Path

root = Path("macapp/build/GetMe.app/Contents/Resources/web")
html_path = root / "index.html"
html = html_path.read_text()

css_match = re.search(r'<link rel="stylesheet" crossorigin href="([^"]+\.css)">', html)
js_match = re.search(r'<script type="module" crossorigin src="([^"]+\.js)"[^>]*></script>', html)
if not css_match or not js_match:
    raise SystemExit("Gebündelte CSS/JS-Tags nicht gefunden")

css_path = root / css_match.group(1).removeprefix("./")
js_path = root / js_match.group(1).removeprefix("./")
css = css_path.read_text()
js = js_path.read_text()
html = html.replace(css_match.group(0), f"<style>{css}</style>")
html = html.replace(js_match.group(0), f"<script type=\"module\">{js}</script>")
html_path.write_text(html)
