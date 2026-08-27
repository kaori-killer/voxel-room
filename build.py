#!/usr/bin/env python3
"""src/shell.html + vendor/three.cjs.min.js + src/app.js -> index.html

three.js 는 UMD 빌드(three.min.js)가 r150+ 에서 콘솔에 deprecation 경고를 남기므로,
경고가 없는 CommonJS 빌드를 최소화해 감싸 쓴다.
"""
import pathlib

base = pathlib.Path(__file__).parent
shell = (base / "src/shell.html").read_text(encoding="utf-8")
three_cjs = (base / "vendor/three.cjs.min.js").read_text(encoding="utf-8")
app = (base / "src/app.js").read_text(encoding="utf-8")

three = (
    "(function(){var module={exports:{}};var exports=module.exports;\n"
    + three_cjs
    + "\nwindow.THREE=module.exports;})();"
)

for src, name in ((three, "three"), (app, "app")):
    if "</script" in src.lower():
        raise SystemExit(f"{name}: </script> 문자열이 들어 있어 인라인할 수 없습니다")

body = shell.replace("/*__THREE__*/", three).replace("/*__APP__*/", app)

page = (
    "<!doctype html>\n"
    '<html lang="ko">\n<head>\n'
    '<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    '<meta name="description" content="그림 한 장을 복셀 3D 오브제로 깎아 내 방에 꺼내 놓고 꾸미는 도구.">\n'
    '<meta name="color-scheme" content="light dark">\n'
    "</head>\n<body>\n" + body + "\n</body>\n</html>\n"
)

out = base / "index.html"
out.write_text(page, encoding="utf-8")
print(f"index.html  {len(page.encode()) // 1024} KB")
