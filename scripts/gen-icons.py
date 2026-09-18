"""生成 TabNest 图标（16/32/48/128 PNG）。
纯标准库实现：4 倍超采样 + 手写 PNG 编码，无需 Pillow。
用法：python scripts/gen-icons.py
"""
from __future__ import annotations

import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "icons")

# 与 Topbar 品牌标一致的四个色块（viewBox 24x24）
SQUARES = [
    (1.5, 1.5, 10.0, 10.0, 3.0, (15, 138, 107)),
    (12.5, 1.5, 10.0, 10.0, 3.0, (44, 111, 219)),
    (1.5, 12.5, 10.0, 10.0, 3.0, (224, 71, 62)),
    (12.5, 12.5, 10.0, 10.0, 3.0, (217, 162, 32)),
]

SS = 4  # 超采样倍数


def inside_round_rect(px: float, py: float, x: float, y: float, w: float, h: float, r: float) -> bool:
    if px < x or py < y or px > x + w or py > y + h:
        return False
    r = min(r, w / 2, h / 2)
    cx = min(max(px, x + r), x + w - r)
    cy = min(max(py, y + r), y + h - r)
    dx = px - cx
    dy = py - cy
    return dx * dx + dy * dy <= r * r


def render(size: int) -> bytes:
    """返回 RGBA 行缓冲（已加 filter 字节）"""
    unit = size / 24.0
    rows = []
    for py in range(size):
        row = bytearray()
        row.append(0)  # filter: none
        for px in range(size):
            acc_r = acc_g = acc_b = acc_a = 0
            for sy in range(SS):
                for sx in range(SS):
                    # 像素中心点坐标（换算回 24 单位空间）
                    fx = (px + (sx + 0.5) / SS) / unit
                    fy = (py + (sy + 0.5) / SS) / unit
                    hit = None
                    for sx0, sy0, w, h, r, color in SQUARES:
                        if inside_round_rect(fx, fy, sx0, sy0, w, h, r):
                            hit = color
                            break
                    if hit:
                        acc_r += hit[0]
                        acc_g += hit[1]
                        acc_b += hit[2]
                        acc_a += 255
            n = SS * SS
            if acc_a == 0:
                row += b"\x00\x00\x00\x00"
            else:
                cover = acc_a // n
                row += bytes(
                    (
                        acc_r * 255 // acc_a if acc_a else 0,
                        acc_g * 255 // acc_a if acc_a else 0,
                        acc_b * 255 // acc_a if acc_a else 0,
                        cover,
                    )
                )
        rows.append(bytes(row))
    return b"".join(rows)


def write_png(path: str, size: int) -> None:
    raw = render(size)
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)
    print(f"{path}  {size}x{size}  {len(png)} bytes")


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in (16, 32, 48, 128):
        write_png(os.path.join(OUT_DIR, f"icon-{size}.png"), size)


if __name__ == "__main__":
    main()
