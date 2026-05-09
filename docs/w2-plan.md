# W2 계획서 (M0 마무리)

**기간**: W2 = May 11–17, 2026 (월–일)
**마일스톤**: M0 완료
**전제**: W1 끝났고, 다음이 라이브:
- 분석 도구 (마켓 리스트, 페어 상세, 가격 티커, 펀딩 히스토리)
- 룰 미리보기 페이지 (실시간 평가)
- 워치리스트 (localStorage)
- DB 스키마 v0 (Supabase에 적용됨)
- Sentry 모니터링

---

## 1. W2 목표

> M0를 끝내고, M1(W3-W4) 시작 시 막힘없이 진입할 수 있는 인프라 토대를 만든다.

W2가 끝나면 다음이 가능해야 한다:
- 사용자 룰을 DB에 저장할 수 있는 토대 (스키마 + helper 함수)
- 실시간 데이터를 받을 WebSocket 워커 PoC
- M1에 자체 캔들 차트 + 청산 피드를 작성할 준비 완료
- M3을 위한 Hyperliquid 주문 SDK 사전 연구 완료
- Agent Wallet 호환 OrderExecutor 인터페이스 정의 완료

---

## 2. 일별 작업

### Mon (Day 8)
**오전**: 코드베이스 정리 + 기술 부채 청산
- 미사용 import 제거
- TypeScript 엄격 모드 점검
- README 업데이트 (현재 상태 반영)
- `lib/supabase/server.ts`에 helper 함수 (`getServerClient()`) 추가
- DB 헬퍼: `lib/db/rules.ts`, `lib/db/users.ts`, `lib/db/orders.ts` 스켈레톤

**오후**: WebSocket 워커 PoC (1/2)
- `workers/hl-ws/` 디렉토리 신규
- `package.json` 따로 (워커는 별도 배포)
- Hyperliquid WebSocket 연결 테스트 (`wss://api.hyperliquid.xyz/ws`)
- `trades`, `bbo`, `userEvents` 구독 동작 확인
- ping/pong 루프 (60초 타임아웃 회피)

### Tue (Day 9)
**오전**: WebSocket 워커 PoC (2/2)
- 수신 데이터 → Supabase 저장 흐름 (예: 청산 이벤트)
- 재연결 로직 (네트워크 단절 시)
- 헬스체크 엔드포인트 (`/healthz`)
- 로컬에서 1시간 연속 가동 검증

**오후**: 자체 캔들 차트 라이브러리 선정
- 후보: `lightweight-charts` (TradingView 무료) vs `recharts` vs `visx`
- 결정: **lightweight-charts** (TradingView 자체 라이브러리, 캔들 차트 특화, 60kb)
- 설치 + 페어 상세 페이지에 stub 컴포넌트 추가
- TradingView 임베드 옆에 나란히 배치하여 비교 모드

### Wed (Day 10)
**오전**: OrderExecutor 인터페이스 작성
- `lib/execution/order-executor.ts` 타입 정의 (W1 Day 7 메모대로)
- `lib/execution/mock-executor.ts` — 테스트용 가짜 executor
- 단위 테스트 골격 (`__tests__/order-executor.test.ts`)
- `vitest` 도입 (가벼운 테스트 러너)

**오후**: Hyperliquid 주문 SDK 사전 연구 메모
- 공식 Python SDK 코드 분석
- TypeScript 커뮤니티 SDK (`nktkas/hyperliquid`) 평가
- 결정: **공식 패턴 따라 자체 구현** vs 커뮤니티 SDK 사용
- EIP-712 서명 흐름 다이어그램 작성
- 메모: `docs/hyperliquid-sdk-research.md`

### Thu (Day 11)
**오전**: 룰 미리보기 → DB 마이그레이션 준비
- `lib/rules/examples.ts`의 6개 예시 룰 → `rules` 테이블에 시드 데이터로 삽입 가능하게
- 마이그레이션 0002: 시드 룰 삽입 (system user 1개 추가)
- `/rules` 페이지가 DB에서 읽도록 (Supabase 클라이언트 연결)
- 폴백: DB 연결 실패 시 `lib/rules/examples.ts` 사용

**오후**: 모니터링 검증
- Sentry 대시보드에서 첫 에러 캡처 확인
- 의도적 에러 트리거 (테스트 페이지) → Sentry로 전송 검증
- 알림 설정 (이메일 또는 디스코드 webhook)

### Fri (Day 12)
**오전**: KOL 발굴 사전 작업 (대표님 액션)
- Hyperliquid 디스코드 가입 (W4 즈음 활성화 결정 다시)
- Twitter 익명 계정 — 알파 이후로 미루지만, 이름은 미리 점검
- 분석 KOL 5명 리스트업 (영문, P1 페르소나가 팔로우할 사람)

**오전**: WebSocket 워커 배포
- Fly.io 또는 Railway 결정 (Vercel은 long-running 워커 부적합)
- 추천: **Fly.io** (무료 티어, $0/월, 기본 256MB)
- 배포 + 24시간 가동 검증 시작

**오후**: M1 작업 분해 + 위험 식별
- W3-W4 일별 작업표 작성
- M1 위험 요소 5개 식별 + 완화책

### Sat (Day 13)
**휴식 또는 백로그 처리**

가능한 백로그:
- 페어 상세 페이지 모바일 폴리싱 추가
- API 문서 작성 (`/api/v1/*` 엔드포인트들)
- Lighthouse 성능 점수 측정 + 최적화

### Sun (Day 14)
**오전**: W2 회고 + W3 준비
- W2 산출물 검증
- 발견된 이슈 정리
- W3 작업 항목 최종 확정

---

## 3. W2 산출물 (Deliverables)

| 항목 | 형태 | 위치 |
|---|---|---|
| WebSocket 워커 PoC | 별도 패키지 | `workers/hl-ws/` |
| 워커 배포 (Fly.io) | 24시간 가동 인스턴스 | Fly.io 대시보드 |
| OrderExecutor 인터페이스 | TypeScript 코드 | `lib/execution/order-executor.ts` |
| Hyperliquid SDK 연구 메모 | 마크다운 | `docs/hyperliquid-sdk-research.md` |
| DB helper 함수 | TypeScript 코드 | `lib/db/*.ts` |
| 룰 미리보기 → DB 연결 | 통합된 기능 | `/rules` 페이지 |
| 자체 캔들 차트 stub | TypeScript + lightweight-charts | `components/CandleChart.tsx` |
| Sentry 검증 | 캡처된 에러 | Sentry 대시보드 |
| M1 일별 작업표 | 마크다운 | `docs/m1-plan.md` |

---

## 4. M1 (W3-W4) 준비

W2가 끝나면 W3-W4 첫 날 막힘없이 들어갈 수 있어야 한다. 다음이 미리 결정되거나 PoC 단계로 마련됨:

- ✅ WebSocket 인프라 (Fly.io 배포 검증)
- ✅ 캔들 차트 라이브러리 결정
- ✅ 청산 피드 데이터 모델 (DB 스키마는 0001에 미리)
- ✅ Hyperliquid SDK 접근법
- ✅ OrderExecutor 인터페이스 (M3 가서야 본격 사용이지만 M1에 정의)

---

## 5. W2 위험 요소

| 위험 | 가능성 | 영향 | 완화 |
|---|---|---|---|
| WebSocket 워커가 Fly.io 무료 티어 한계로 OOM | 중 | M1 지연 | 256MB 충분, 모니터링 + 메모리 누수 검증 |
| Hyperliquid SDK 학습 곡선 | 중 | M3 지연 | W2에 사전 연구 완료해두기 |
| Sentry 통합 후 클라이언트 번들 사이즈 부담 | 낮 | UX 미세 영향 | lazy-load 옵션 검토 (필요 시) |
| Supabase 무료 티어 제한 (500MB) | 낮 | M2 지연 | 시계열 데이터는 Upstash Redis로 분리 |
| 코드 작성자 단일 의존 (대표님 GitHub 업로드 의존) | 중 | 모든 작업 | M3 전 CTO 영입이 우선 |

---

## 6. 추적 — 결정 미진행 항목 (W1 Day 4 점검 → W2 처리)

W1에서 보류한 결정들:

| 항목 | W1 Day 4 결정 | W2 액션 |
|---|---|---|
| 세무사 컨설팅 | 더 고민 | **W3-W4 전까지 결정 필요** |
| BVI 에이전트 선정 | 미진행 | W3-W4 전 견적 3곳 받기 |
| Hyperliquid 디스코드 참여 | 보류 (W4에 다시) | 그대로 |
| CTO 영입 | 미진행 | M3 전(W6) 영입 시작 강력 권장 |
| 알파 성공 기준 | 미확정 | **W3-W4에 정의** |

W2엔 코드 작업이 주이지만 위 비코드 결정들도 시급도 증가 중. 특히 **세무사 + CTO 영입 시작**은 M3까지 6주 남았으니 더 미루기 어려움.

---

## 7. 한 줄 요약

> W2 = M0 마지막 + M1 무대 설치. 코드 새 기능보단 다음 4주 작업의 토대를 다지는 주.
