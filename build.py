"""Build the offline editor with Python's standard library."""
import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"


def read(name):
    return (SRC / name).read_text(encoding="utf-8")


def font_face(family, filename, weights):
    encoded = base64.b64encode((SRC / filename).read_bytes()).decode("ascii")
    return (
        f'@font-face{{font-family:"{family}";font-style:normal;font-weight:{weights};'
        f'src:url(data:font/woff2;base64,{encoded}) format("woff2");font-display:swap}}\n'
    )


def build():
    fonts = font_face("DM Sans", "sans.woff2", "400 800")
    fonts += font_face("IBM Plex Mono", "mono.woff2", "400 500")
    modules = ["icons.js", "presets.js", "render.js", "masks.js", "app.js"]
    script = "\n".join(read(name) for name in modules)
    script = script.replace("/* THUMBNAILS */{}", read("thumbs.json"))
    page = read("shell.html").replace("/* BUNDLE_STYLE */", fonts + read("style.css"))
    page = page.replace("/* BUNDLE_SCRIPT */", script)
    licenses = read("font-licenses.txt").replace("--", "—")
    page = page.replace("</html>", f"<!--\n{licenses}\n-->\n</html>")
    (ROOT / "index.html").write_text(page, encoding="utf-8")


if __name__ == "__main__":
    build()
