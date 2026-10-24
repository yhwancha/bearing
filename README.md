# 베어링 (Bearing)

배에 들어가는 모든 물건의 세관 서류를 대신 쓰는 AI.

타깃: 아시아 최대 해운 허브인 싱가포르의 선용품 공급사와 선박 대리점, 이후 같은 구조의 해운 허브 항만으로 확장.

## 하는 일

대리점 메일을 붙여 넣으면 선박 정보와 품목을 읽고, 품목마다 싱가포르 세관 처리 경로를 정해 서류를 만든다.

| 경로 | 처리 | 베어링 출력 |
| --- | --- | --- |
| 세금 납부 선용품 | 허가 없음, 월간 명세서 보고 | 월간 명세서 |
| 세금 미납 선용품 | TradeNet OUT (APS) | 허가 미리보기 · 엑셀 |
| 주류 · 담배 | APS + 승인 선박 + 1인 1일 배급 한도 | 배급 게이지 · 초과 차단 |
| 통제 품목 | 기관 승인 후 OUT (DRT) | 기관 승인 체크리스트 |
| 설치용 부품 | 선용품 아님, GST 대상 | 제외 + 경고 |

AI는 읽기와 분류 제안만 한다. 승인된 분류는 규칙으로 저장되고, 경로 분할·한도·금액은 코드(`src/engine.ts`, `src/sg.ts`)가 계산한다. 같은 발주는 늘 같은 신고서가 된다.

## 시연 (3분)

1. Orders → New order → Use sample email → Read order
2. 규칙 없는 펌프 부품: Suggest classification → "설치용이라 선용품 아님" 근거 확인 → Approve
3. Prepare declaration: 4개 경로로 분할, 담배 12,000개비 vs 허용 4,000개비 초과 → Cut to 20 CTN
4. 신호탄 기관 승인 체크 → Confirm declaration → TradeNet 미리보기 · Export .xlsx
5. Record delivery → Statements에 반영
6. 같은 메일을 다시 넣으면 AI 없이 규칙만으로 바로 같은 결과

처음 상태로 되돌리기: Overview → Reset demo

## 개발

```bash
npm install
npm run dev
npm test
```

- `ANTHROPIC_API_KEY`가 있으면 로컬에서도 `/api/read`, `/api/propose`가 돈다(`claude-opus-5-5`). 없으면 내장 판독기와 키워드 제안으로 폴백하고 화면에 사유를 보여 준다.
- 데이터는 브라우저 저장(`bearing.v1`). 손대지 않은 데모는 오늘 날짜 기준으로 다시 만들어진다.
- 배포: Vercel(`vercel.json`), 환경변수 `ANTHROPIC_API_KEY`.

## 구조

| 경로 | 내용 |
| --- | --- |
| `src/sg.ts` | 싱가포르 규칙: 배급 한도, 승인 선박, 경로 분할, 제출 전 점검, 월간 명세서 |
| `src/engine.ts` | 규칙 매칭, 오프라인 메일 판독기 |
| `src/heuristics.ts` | 오프라인 분류 제안 |
| `src/tradenet.ts` | TradeNet 허가 미리보기 · 엑셀 시트 |
| `src/pages/` | Overview, Orders, Order, Declaration, Delivery, Statements, Catalog, Rules |
| `api/` | Vercel 함수: `read`, `propose` |

## 설계 문서

- [싱가포르 세관 모듈 설계](https://claude.ai/artifact/UEPF7vCoZxWvjMKWYx9sgi) (Claude Docs)
- [구현 계획](docs/PLAN.md)

## 가상 · 확인 필요

- 공급사·대리점·선박·허가 번호는 모두 가상(`Demo`, `.demo` 도메인)
- 통제 품목 예시(신호탄 → SPF Arms & Explosives)는 데모 가정
- TradeNet 필드는 세관 안내 기준 초안 — Module 5 Important Permit Fields로 확인 필요
