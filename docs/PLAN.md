# 구현 계획

설계 문서: [싱가포르 세관 모듈 설계](https://claude.ai/artifact/UEPF7vCoZxWvjMKWYx9sgi)

## 목표

대리점 메일 한 통을 붙여 넣으면 베어링이 선박 정보와 품목을 읽고, 품목마다 싱가포르 처리 경로를 정해
TradeNet 신고서 초안 · 배급 한도 검사 · 기관 승인 체크리스트 · 월간 명세서를 만든다.
3분 시연 흐름(설계 문서)이 끝까지 도는 것이 완료 기준이다.

## 원칙

- **결정적 엔진**: AI는 읽기와 분류 제안만 한다. 분류 적용, 묶음 나누기, 한도·금액 계산은 전부 코드(`src/engine.ts`, `src/sg.ts`)가 한다. 같은 발주는 늘 같은 신고서가 된다.
- **분류는 제품에 붙인다**: 승인된 SG 분류는 제품에 저장되고 규칙이 그 제품을 가리킨다. 다음 발주부터는 AI 없이 적용된다.
- **글로벌 UI**: 영어 UI, `en-SG` 숫자·날짜 형식, SGD 기본 통화. 문구는 `src/i18n.ts` 한 곳에 모아 다른 언어를 추가할 수 있게 한다. 라이트·다크 모드 모두 지원.
- **오프라인 데모 가능**: `/api`가 없거나 실패하면 내장 휴리스틱으로 폴백하고 화면에 표시한다. 데이터는 브라우저 저장(`bearing.v1`).

## 스택

Vite + React 19 + TypeScript, react-router, Vitest(엔진 단위 테스트), Vercel Functions(`api/`) + Anthropic SDK(`claude-opus-5-5`, 구조화 출력), xlsx 내보내기는 fflate로 직접 생성.

## 싱가포르 규칙 (Singapore Customs, 2026-10-24 확인)

| 항목 | 값 |
| --- | --- |
| 주류·담배 허용 선박 | passenger, cargo, oil rig, dredge, fishing, supply boat, tug |
| 1인 1일 배급 | 담배 40개비 · 파이프/잎담배 15g · 시가 3개비 · 와인 0.25병 · 증류주 0.25병 · 맥주 4캔 |
| 허가 | 미납 선용품 OUT / APS, 통제 품목(세금 납부) OUT / DRT, CPC `SEASTORE` |
| 월간 명세서 | 세금 납부·비통제 선용품은 허가 없이 공급하되 Monthly Statement of Stores Supplied to Vessels에 보고 |

출처: [Supply of Air/Sea Stores](https://www.customs.gov.sg/doing-business/export-operations/export-procedures/supply-of-air-sea-stores/)

## 화면

| 경로 | 화면 |
| --- | --- |
| `/` | Overview — 오늘 처리할 발주, 차단 사유(배급 초과, 기관 승인 대기, 분류 필요) |
| `/orders` | Orders — 목록 + 새 발주(메일 붙여넣기) |
| `/orders/:id` | Order — 읽은 선박 정보·품목, 분류 상태, 분류 제안 승인 |
| `/orders/:id/declaration` | Declaration — 경로별 카드 4개, 배급 게이지, 제출 전 점검, TradeNet 미리보기·엑셀 |
| `/orders/:id/delivery` | Delivery — 실제 인도 수량 확인 |
| `/statements` | Monthly statement — 선박별 합계, 엑셀 |
| `/catalog` | Catalog — 제품과 SG 분류·기관·배급 단위 |
| `/rules` | Rules — 승인된 규칙 라이브러리 |

## 커밋 단위

1. `docs`: 구현 계획 (이 문서)
2. `chore`: 프로젝트 스캐폴드 (Vite, TS, Vitest, 라우터)
3. `feat(ui)`: 디자인 토큰, 기본 컴포넌트, 앱 셸
4. `feat(core)`: 도메인 타입, 금액·날짜 형식, 저장소
5. `feat(engine)`: 토큰화·규칙 매칭·규격 정규화·휴리스틱 판독기 + 테스트
6. `feat(sg)`: 싱가포르 엔진(분류 해석, 선박 종류, 배급 한도, 묶음 나누기, 점검, 월간 명세서) + 테스트
7. `feat(seed)`: 싱가포르 데모 데이터(공급사 1, 대리점 2, 선박 2, 제품 15, 함정 발주 1)
8. `feat(orders)`: 발주 목록·접수·상세
9. `feat(rules)`: 분류 제안 승인, 규칙 라이브러리
10. `feat(declaration)`: 신고서 작업 화면
11. `feat(tradenet)`: TradeNet 미리보기 + 엑셀 내보내기
12. `feat(delivery)`: 인도 수량 확인
13. `feat(statements)`: 월간 명세서
14. `feat(catalog)`: 제품 관리
15. `feat(ai)`: `/api/read`, `/api/propose` + 폴백 연결
16. `docs`: README 갱신

## 확인 필요

- TradeNet 선용품 신고 필수 필드 전체 — Module 5 Important Permit Fields에서 확인 후 미리보기 열 보정
- 데모용 통제 품목·담당 기관 — 실제 통제 목록에서 고르기 전까지 가상 예시로 표시
