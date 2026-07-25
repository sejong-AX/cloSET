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

/** 캔버스로 최대 max px 로 줄인 JPEG data URL. 컨텍스트 실패 시 원본 src 반환. */
export function scaleImage(img: HTMLImageElement, max: number, quality: number): string {
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * s));
  const h = Math.max(1, Math.round(img.height * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const cx = c.getContext("2d");
  if (!cx) return img.src;
  cx.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", quality);
}

/** 파일 → 다운스케일된 JPEG data URL. 이미지가 아니면 reject. */
export function fileToDataUrl(file: File, max = 768, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("type"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = async () => {
      try {
        const img = await loadImage(reader.result as string);
        resolve(scaleImage(img, max, quality));
      } catch (e) {
        reject(e);
      }
    };
    reader.readAsDataURL(file);
  });
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
    // 화면에 의미 있게 보일 최소 크기(사진의 4%)가 안 되면 실패 처리
    if (bw < W * 0.04 || bh < H * 0.04) return null;
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
