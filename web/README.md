# cloSET Web (Next.js)

`mockup/index.html` 의 초상세 IA 목업을 실제 웹앱으로 구현한 Next.js 애플리케이션입니다. 디자인 토큰과 DOM 구조를 원본 목업과 동일하게 유지해 **디자인 충실도**를 보존하고, 그 위에 **GSAP** 진입 애니메이션과 **OpenAI GPT-4o** 서버 연동을 얹었습니다.

## 스택

- **Next.js 16 (App Router) · React 19 · TypeScript**
- **GSAP** — 뷰 진입 stagger, 숫자 카운트업, 스파크라인 드로잉, 가먼트 랙 연출
- **OpenAI GPT-4o** — 서버 라우트(`app/api/*`)에서만 호출 (키는 클라이언트에 노출되지 않음)

## 핵심 설계: 판정과 표현의 분리

cloSET 원칙에 따라 **수치·등급 판정은 결정적 코드**가, **표현(문장)은 LLM**이 담당합니다.

- `lib/rules.ts` — BUY/STOP/ALTERNATIVE 판정, 중복 위험, 회당 비용(CPW), 케어 심볼·온도를 **코드로 결정**
- `app/api/scan/route.ts`, `app/api/care/route.ts` — 위 확정 수치를 GPT-4o 에 넘겨 **이유 문장만** 생성. OpenAI 실패·미설정 시 **결정적 폴백** 문구로 안전하게 동작

## 화면

로그인 · 오늘의 착장 · 내 옷장 · Snap & Check(Smart Checker) · 케어 허브(Care Label AI) · 순환하기(Re:Using) · 지출·탄소 인사이트 · 설정

## 로컬 실행

```bash
cd web
npm install
cp .env.example .env.local   # OPENAI_API_KEY 입력
npm run dev                  # http://localhost:3000
```

## 테스트 · 빌드

```bash
npm test        # 결정 규칙 단위 테스트 (node --test)
npm run build   # 타입체크 + 프로덕션 빌드
```

## 환경 변수

| 변수 | 설명 |
|------|------|
| `OPENAI_API_KEY` | GPT-4o 서버 호출용. **커밋 금지** — `.env.local` 또는 Vercel 환경 변수에 저장 |
| `OPENAI_MODEL` | 기본 `gpt-4o` |

## 배포 (Vercel)

Root Directory 를 `web/` 로 지정하고 위 환경 변수를 등록합니다. Next.js 프리셋으로 자동 빌드됩니다.

## QA 에이전트

`.claude/agents/` 에 3종의 검수 서브에이전트가 정의되어 있습니다.

- `copy-proofreader` — 문구 깨짐·오타·어색한 한국어 교정
- `design-fidelity` — 목업 대비 레이아웃·위치·겹침 판정
- `functional-qa` — 전 기능 동작 검수
