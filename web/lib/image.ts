// 이미지 다운스케일·크롭 공용 유틸.
// Snap & Check(상품 사진), 사진으로 옷장 채우기(품목별 크롭), 체형 추천(전신 사진)에서 함께 쓴다.

export interface Box {
  x: number; // 왼쪽 위 기준 백분율 0~100
  y: number;
  w: number;
  h: number;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("img"));
    img.onload = () => resolve(img);
    img.src = src;
  });
}

/** 캔버스에 그릴 수 있는 이미지 소스 */
export type ImageSource = HTMLImageElement | ImageBitmap;

/**
 * 파일 → EXIF 회전이 반영된 이미지 소스.
 * 휴대폰 사진은 세로로 찍어도 EXIF 로만 회전이 기록돼 있어, 그대로 캔버스에 그리면
 * 90도 누운 상태로 분석·크롭된다(옷 종류 오인·엉뚱한 썸네일의 원인).
 * createImageBitmap 의 imageOrientation:"from-image" 로 픽셀 자체를 바로 세운다.
 */
export async function loadOriented(file: File): Promise<ImageSource> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* 미지원 브라우저 → 아래 폴백 */
    }
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
  return loadImage(dataUrl);
}

/** 캔버스로 최대 max px 로 줄인 JPEG data URL. 컨텍스트 실패 시 빈 문자열. */
export function scaleImage(img: ImageSource, max: number, quality: number): string {
  const sw = img.width;
  const sh = img.height;
  const s = Math.min(1, max / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * s));
  const h = Math.max(1, Math.round(sh * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const cx = c.getContext("2d");
  if (!cx) return img instanceof HTMLImageElement ? img.src : "";
  cx.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", quality);
}

/** 파일 → 다운스케일된 JPEG data URL. 이미지가 아니면 reject. */
export async function fileToDataUrl(file: File, max = 768, quality = 0.82): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("type");
  const img = await loadOriented(file);
  return scaleImage(img, max, quality);
}

/**
 * 사진(data URL)의 대표색 — 가운데 60% 영역 픽셀의 중앙값.
 * 옷 이름·비전이 색을 못 줬을 때만 쓰는 폴백이라 정확도보다 견고함이 중요하다.
 * 실패하면 null.
 */
export async function dominantHex(src: string): Promise<string | null> {
  try {
    const img = await loadImage(src);
    const n = 32;
    const c = document.createElement("canvas");
    c.width = n;
    c.height = n;
    const cx = c.getContext("2d", { willReadFrequently: true });
    if (!cx) return null;
    cx.drawImage(img, 0, 0, n, n);
    const lo = Math.floor(n * 0.2);
    const hi = Math.ceil(n * 0.8);
    const { data } = cx.getImageData(lo, lo, hi - lo, hi - lo);
    const rs: number[] = [];
    const gs: number[] = [];
    const bs: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      rs.push(data[i]);
      gs.push(data[i + 1]);
      bs.push(data[i + 2]);
    }
    if (rs.length === 0) return null;
    const mid = (arr: number[]) => {
      arr.sort((a, b) => a - b);
      return arr[Math.floor(arr.length / 2)];
    };
    const hex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
    return `#${hex(mid(rs))}${hex(mid(gs))}${hex(mid(bs))}`;
  } catch {
    return null;
  }
}

/**
 * data URL 사진에서 box(백분율) 영역을 잘라 품목별 썸네일을 만든다.
 * 여백(pad)을 두르고 사진 경계로 클램프한다. box 가 없거나 지나치게 작으면 null(호출부 폴백).
 */
export async function cropDataUrl(
  src: string,
  box: Box | undefined | null,
  opts: { pad?: number; outMax?: number; quality?: number } = {}
): Promise<string | null> {
  const { pad = 0.08, outMax = 384, quality = 0.66 } = opts;
  if (!box) return null;
  const nums = [box.x, box.y, box.w, box.h];
  if (nums.some((n) => typeof n !== "number" || !isFinite(n))) return null;
  try {
    const img = await loadImage(src);
    const W = img.width;
    const H = img.height;
    let bx = (box.x / 100) * W;
    let by = (box.y / 100) * H;
    let bw = (box.w / 100) * W;
    let bh = (box.h / 100) * H;
    // 비전 bbox 가 살짝 타이트한 경향 → 긴 변 기준 여백을 두른다
    const margin = Math.max(bw, bh) * pad;
    bx -= margin;
    by -= margin;
    bw += margin * 2;
    bh += margin * 2;
    // 경계 클램프
    bx = Math.max(0, bx);
    by = Math.max(0, by);
    bw = Math.min(W - bx, bw);
    bh = Math.min(H - by, bh);
    // 옷장 전체 사진에서는 옷 한 벌이 사진의 몇 %에 불과하다 — 2% 미만만 실패 처리.
    // (여기서 너무 크게 자르면 여러 옷이 같은 썸네일을 공유해 '따로 아이템화'가 무너진다)
    if (bw < W * 0.02 || bh < H * 0.02) return null;
    const s = Math.min(1, outMax / Math.max(bw, bh));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bw * s));
    c.height = Math.max(1, Math.round(bh * s));
    const cx = c.getContext("2d");
    if (!cx) return null;
    cx.drawImage(img, bx, by, bw, bh, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}
