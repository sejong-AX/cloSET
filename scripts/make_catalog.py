#!/usr/bin/env python3
"""
의류 단품 사진 → 배경을 지운 카탈로그 컷(PNG) + 대표색 측정.

왜 필요한가: cloSET 은 "옷 한 점 = 이미지 한 장" 규칙을 지킨다. 인식된 옷과 가장 비슷한
실제 사진을 먼저 쓰고(web/lib/garment-catalog.ts), 없을 때만 그림을 만든다.
카탈로그 사진은 배경이 남아 있으면 옷장 카드에서 다른 옷·벽이 함께 보이므로,
테두리에서 이어진 단색 배경을 알파로 지우고 옷 영역만 남긴다.

사용:
  python3 scripts/make_catalog.py <입력파일> <출력이름> [--tol 34]
  python3 scripts/make_catalog.py --measure web/public/items/catalog/*.png

출력: web/public/items/catalog/<출력이름>.png  +  붙여 넣을 카탈로그 항목 한 줄
"""
import argparse
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "web", "public", "items", "catalog")


def remove_background(im: Image.Image, tol: float = 34.0) -> Image.Image:
    """테두리에서 이어진 배경만 지운다(옷 안쪽의 같은 색은 남는다)."""
    im = im.convert("RGB")
    a = np.asarray(im).astype(np.int16)
    h, w, _ = a.shape
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    close = np.sqrt(((a - bg) ** 2).sum(2)) < tol

    # 테두리에서 시작하는 flood fill — 옷 안쪽의 흰 부분은 지워지지 않는다
    visited = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if close[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if close[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and close[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    alpha = np.where(visited, 0, 255).astype(np.uint8)
    rgba = np.dstack([np.asarray(im).astype(np.uint8), alpha])
    return Image.fromarray(rgba, "RGBA")


def trim(im: Image.Image, pad: int = 12) -> Image.Image:
    a = np.asarray(im)
    mask = a[..., 3] > 24
    if not mask.any():
        return im
    ys, xs = np.where(mask)
    y0, y1 = max(0, ys.min() - pad), min(a.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(a.shape[1], xs.max() + pad + 1)
    return im.crop((x0, y0, x1, y1))


def dominant(im: Image.Image) -> str:
    a = np.asarray(im.convert("RGBA")).astype(np.float32)
    m = a[..., 3] > 200
    if m.sum() < 50:
        return "#888888"
    px = a[..., :3][m]
    med = np.median(px, axis=0)
    return "#%02x%02x%02x" % tuple(int(v) for v in med)


def coverage(im: Image.Image) -> float:
    a = np.asarray(im.convert("RGBA"))
    return float((a[..., 3] > 24).mean())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", nargs="?")
    ap.add_argument("name", nargs="?")
    ap.add_argument("--tol", type=float, default=34.0)
    ap.add_argument("--kind", default="?")
    ap.add_argument("--measure", nargs="*", help="기존 PNG 의 대표색만 다시 잰다")
    args = ap.parse_args()

    if args.measure:
        for p in args.measure:
            im = Image.open(p)
            im.thumbnail((200, 200))
            print(f'{os.path.basename(p):28s} {dominant(im)}  덮는비율={coverage(im):.2f}')
        return 0

    if not args.src or not args.name:
        ap.error("src 와 name 이 필요합니다")

    os.makedirs(OUT_DIR, exist_ok=True)
    im = Image.open(args.src)
    im.thumbnail((900, 900))
    cut = trim(remove_background(im, args.tol))
    cut.thumbnail((512, 512))
    dst = os.path.join(OUT_DIR, f"{args.name}.png")
    cut.save(dst, optimize=True)
    small = cut.copy()
    small.thumbnail((200, 200))
    print(f"저장: {dst}  ({cut.width}x{cut.height}, 덮는비율={coverage(cut):.2f})")
    print(f'  {{ src: "/items/catalog/{args.name}.png", kind: "{args.kind}", color: "{dominant(small)}" }},')
    return 0


if __name__ == "__main__":
    sys.exit(main())
