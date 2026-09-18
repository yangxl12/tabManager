#!/usr/bin/env python3
"""把 dist/ 打成可分发的扩展包，产出到 release/。

产出两份：
  release/tabnest-<version>/      解压目录，浏览器「加载已解压的扩展程序」直接指向它
  release/tabnest-<version>.zip   安装包，用于上传 Chrome Web Store / Edge 加载项商店

注意：zip 内必须使用 "/" 分隔符，且 manifest.json 位于根目录（不能套一层文件夹），
否则商店上传会报 "Manifest file is missing or unreadable"。
PowerShell 5.1 的 Compress-Archive 会写反斜杠路径，所以这里用标准库 zipfile。
"""

from __future__ import annotations

import json
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
RELEASE = ROOT / "release"

# 商店上传体积上限（Chrome Web Store 为 2GB，这里只做异常提醒）
SIZE_WARN_MB = 20


def fail(msg: str) -> None:
    print(f"[x] {msg}", file=sys.stderr)
    sys.exit(1)


def verify(dist: Path) -> dict:
    """打包前的硬校验，任何一条不过就直接中止。"""
    manifest_path = dist / "manifest.json"
    if not manifest_path.is_file():
        fail("dist/manifest.json 不存在，先跑 npm run build")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    for key in ("manifest_version", "name", "version", "description"):
        if not manifest.get(key):
            fail(f"manifest.json 缺少必填字段：{key}")
    if manifest["manifest_version"] != 3:
        fail(f"manifest_version 必须是 3，当前是 {manifest['manifest_version']}")

    if len(manifest["description"]) > 132:
        fail("description 超过商店限制的 132 字符")

    # 图标文件必须真实存在，缺一个商店就会打回
    for size, rel in (manifest.get("icons") or {}).items():
        if not (dist / rel).is_file():
            fail(f"图标缺失：{rel}（icons.{size}）")

    # sourcemap 会泄露源码，商店也不欢迎
    maps = list(dist.rglob("*.map"))
    if maps:
        fail(f"产物含 sourcemap，请关闭 build.sourcemap：{maps[0]}")

    # dev 自检页不属于正式包
    for junk in ("_probe.html", "_zoom.html"):
        if (dist / junk).exists():
            fail(f"产物混入开发自检页：{junk}")

    return manifest


def main() -> None:
    if not DIST.is_dir():
        fail("dist 目录不存在，先跑 npm run build")

    manifest = verify(DIST)
    version = manifest["version"]
    stem = f"tabnest-{version}"

    RELEASE.mkdir(exist_ok=True)
    out_dir = RELEASE / stem
    out_zip = RELEASE / f"{stem}.zip"

    # 重建解压目录
    if out_dir.exists():
        shutil.rmtree(out_dir)
    shutil.copytree(DIST, out_dir)

    # 打 zip：逐文件写入，显式使用正斜杠，保证 manifest.json 在根目录
    files = sorted(p for p in DIST.rglob("*") if p.is_file())
    with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in files:
            arcname = path.relative_to(DIST).as_posix()
            zf.write(path, arcname)

    zip_mb = out_zip.stat().st_size / 1024 / 1024
    print(f"[ok] 版本 {version}，共 {len(files)} 个文件")
    print(f"[ok] 解压目录  {out_dir.relative_to(ROOT)}")
    print(f"[ok] 安装包    {out_zip.relative_to(ROOT)}  ({zip_mb:.2f} MB)")
    if zip_mb > SIZE_WARN_MB:
        print(f"[!] 包体积偏大（>{SIZE_WARN_MB} MB），主 JS 建议做代码分割")


if __name__ == "__main__":
    main()
