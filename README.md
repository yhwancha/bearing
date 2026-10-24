# 베어링 (Bearing)

**배에 들어가는 모든 물건의 세관 서류를 대신 쓰는 AI.**

타깃: 아시아 최대 해운 허브인 싱가포르의 선용품 공급사와 선박 대리점, 이후 같은 구조의 해운 허브 항만으로 확장.

선용품 공급사의 서류 담당자는 하루 종일 대리점 메일을 읽고, 품목마다 세관 처리 경로를 판단하고, 담배·주류 배급 한도를 계산하고, TradeNet 신고서와 월간 명세서를 채운다. 베어링은 이 일을 처음부터 끝까지 대신한다. 사람은 AI가 처음 보는 품목의 분류만 한 번 승인하면 된다.

## 왜 베어링인가

### 1. 실제 싱가포르 세관 규칙 그대로

데모용 가짜 규칙이 아니다. 싱가포르 세관(Singapore Customs)의 [선용품 공급 규정](https://www.customs.gov.sg/doing-business/export-operations/export-procedures/supply-of-air-sea-stores/)을 코드로 옮겼다.

| 경로 | 세관 처리 | 베어링 출력 |
| --- | --- | --- |
| 세금 납부 선용품 | 허가 없음, 월간 명세서 보고 | 월간 명세서(선박별 합산) |
| 세금 미납 선용품 | TradeNet OUT (APS), CPC `SEASTORE` | 허가 신청서(화면 · 엑셀 · 인쇄/PDF) |
| 주류 · 담배 | APS + 승인 선박 종류 + 1인 1일 배급 한도 | 배급 게이지 · 초과 시 제출 차단 |
| 통제 품목 | 관할 기관 승인 후 OUT (DRT) | 기관 승인 체크리스트 · 면허 번호를 DRT 허가에 기재 |
| 설치용 부품 | 선용품 아님, GST 대상 | 신고서에서 제외 + 경고 |

- **배급 한도**: 선원 1인 1일 담배 40개비, 잎담배 15g, 시가 3개비, 증류주·와인 0.25병, 맥주 4캔. 선원 수 × 항행 일수로 허용량을 계산하고, 넘으면 신고를 막는다.
- **승인 선박**: 여객선·화물선·석유 시추선·준설선·어선·보급선·예인선만 주류·담배를 받을 수 있다. 선종이 없거나 해당하지 않으면 막는다.
- **필수 항목**: 허가가 필요한 발주는 선박 국적, 선종, 순톤수(NRT), 다음·최종 기항지, 품목별 HS 코드·원산지가 비면 막는다. 항차·출항 일시·IMO는 경고한다.
- **월간 명세서**: 허가 없이 공급한 세금 납부 선용품을 실제 인도 수량으로 선박별 합산한다.

### 2. 쓸수록 똑똑해지는 AI 비서

베어링은 공급사마다 따로 배운다.

1. 처음 보는 표현(`PUMP IMPELLER FOR INSTALLATION`)이 오면 AI가 처리 경로와 근거를 제안한다. "설치용이라 선용품이 아니다."
2. 담당자가 확인하고 승인하면 그 판단이 **규칙**으로 저장된다.
3. 다음 발주부터 같은 표현은 AI를 부르지 않고 규칙이 즉시, 똑같이 처리한다.

승인이 쌓일수록 AI에게 묻는 줄은 줄고, 처리는 빨라지고, 비용은 내려간다. 대리점마다 다른 약어와 표기, 공급사만의 품목 코드와 판단 기준이 규칙 라이브러리에 쌓인다. 이 승인 이력은 공급사의 자산이고, 다른 서비스가 복제할 수 없는 데이터다.

### 3. 사람을 대체하는 AI

| 지금 사람이 하는 일 | 베어링 |
| --- | --- |
| 대리점 메일을 읽고 선박 정보·품목을 옮겨 적기 | 메일을 붙여 넣으면 AI가 읽는다 |
| 품목마다 세금·통제 여부를 판단해 경로 나누기 | 규칙과 AI 제안으로 자동 분할 |
| 담배·주류 배급 한도를 계산기로 확인 | 실시간 게이지, 초과하면 줄일 수량까지 제시 |
| 통제 품목의 기관 승인 챙기기 | 체크리스트, 승인 전에는 제출 불가 |
| TradeNet 입력값 정리 | 허가별 신청서: TradeNet 필드 순서대로 채우고 빠진 항목은 고칠 곳까지 표시 |
| 선장 인수 확인서 작성 | 인쇄본에 Condition A4 인수 확인서 포함 |
| 월말 명세서 취합 | 인도 기록에서 자동 집계 |

서류 담당자가 하던 반복 업무를 베어링이 맡고, 사람은 처음 보는 품목을 승인하는 일만 남는다. 승인된 판단은 규칙이 되어 다시 묻지 않는다.

**믿을 수 있게 설계했다.** AI는 읽기와 분류 제안만 한다. 경로 분할, 한도 계산, 금액은 정해진 코드(`src/engine.ts`, `src/sg.ts`)가 하고, 수량은 원문에서 그대로 옮기며 AI가 숫자를 만들지 않는다. 같은 발주는 늘 같은 신고서가 되고, 확정한 신고서는 고정되어 나중에 규칙이 바뀌어도 달라지지 않는다.

## 실제 동작 예시

아래 입력과 결과는 모두 지금 코드가 내는 값이다. AI 키 없이(오프라인 판독기) 돌린 결과이고, 키가 있으면 같은 자리를 Claude가 읽는다.

### 예시 1. 함정이 섞인 발주 — 메일 한 통이 허가 두 건과 명세서로 갈라진다

대리점 메일(New order → "Mixed order with traps"):

```text
Vessel: MV OCEAN LYRA        IMO: 9734512      Flag: Liberia
Type: Bulk carrier           NRT: 18,450       Voyage No: OL-2611
Crew: 20                     ETD: 27 Oct 18:00
Next port: Port Hedland (5 days)   Final port: Qingdao
Location: Western Anchorage

1. RICE JASMINE 25KG BAG x 10
2. WHISKY 70CL x 24 BTL
3. CIGARETTES 200S CTN x 60
4. PUMP IMPELLER FOR INSTALLATION x 1
5. RED HAND FLARES SOLAS x 6 PCS
6. EGGS FRESH 30PCS TRAY x 12
```

**① 읽기.** 선박 정보 13개 항목과 6줄을 옮긴다. "Bulk carrier"는 화물선(cargo), "Port Hedland (5 days)"는 다음 기항지와 항해 5일로 나뉜다. 대리점은 보낸 주소(`straitsline.demo`)로 알아본다.

**② 분류.** 규칙 라이브러리가 5줄을 바로 제품에 연결한다. 처음 보는 4번만 남고, 분류 제안을 누르면 이렇게 나온다.

> 설치용 부품(ship_spare_install) — "발주에 선박 설치용이라고 적혀 있어 선용품이 아니며 GST가 부과됩니다."

승인하면 규칙이 되어, 같은 표현은 다음부터 AI 없이 처리된다.

**③ 경로 분할.**

| 줄 | 품목 | 경로 | 서류 |
| --- | --- | --- | --- |
| 1, 6 | 쌀, 계란 | 세금 납부 선용품 | 월간 명세서 |
| 2, 3 | 위스키, 담배 | 과세 주류·담배 | TradeNet OUT (APS) |
| 5 | 신호탄 | 통제 품목(SPF Arms & Explosives) | 기관 승인 → TradeNet OUT (DRT) |
| 4 | 펌프 임펠러 | 설치용 부품 | 신고서에서 제외, GST 경고 |

**④ 제출 전 점검.** 세 가지가 신고를 막는다.

- 궐련 담배: 요청 12,000개비, 허용 4,000개비 (선원 20명 × 5일 × 40) → Cut to 20 CTN 버튼 한 번으로 해결
- 위스키는 24병 / 허용 25병으로 통과
- 기관 승인 미확인: SPF Arms & Explosives → 승인 카드에서 체크하고 면허 번호(예: `AE-2026-0142`) 입력

**⑤ TradeNet 허가 신청서.** 확정하면 허가별로 이렇게 채워진다(엑셀 시트 그대로).

| TradeNet 필드 | OUT (APS) | OUT (DRT) |
| --- | --- | --- |
| CPC / Processing Code 1·2 | SEASTORE / 20 / 5 | SEASTORE / 20 / 5 |
| Exporter / UEN | Lion Gate Ship Supply (Demo) / 2026DEMO01K | 같음 |
| Outward Carrier Agent / UEN | Straits Line Agencies (Demo) / 2019DEMO02A | 같음 |
| Vessel · Voyage · NRT | MV OCEAN LYRA · OL-2611 · 18450 | 같음 |
| Next / Final Port of Call | Port Hedland / Qingdao | 같음 |
| 품목 | 위스키 24 BTL → 16.8 LTR, 2208.30, GB<br>담배 20 CTN → 4,000 STK, 2402.20, ID | 신호탄 6 PC, 3604.90, GB, 면허 AE-2026-0142 |
| Total Value | SGD 1,532.00 | SGD 348.00 |

빈 필수 칸이 있으면 "필수 항목 N개 누락" 배지와 함께 고칠 곳(선박 정보 · 카탈로그 · 승인 카드)을 가리키고, 엑셀에는 `MISSING`으로 찍힌다. 인쇄 / PDF를 누르면 A4 신청서 두 장과 선장 인수 확인서(Condition A4, 포장 수량 자동 기재)가 나온다.

**⑥ 인도와 명세서.** Record delivery에서 실제 인도 수량을 적으면 쌀·계란이 그 달 Statements에 선박별로 합산된다.

### 예시 2. 메신저체 약식 메일 — 빠진 정보를 정확히 짚는다

```text
hi team, mv sea heron (panama, imo 9614402) at western anch, eta 1400 today.
20 crew, sailing to manila 4 days. pls send asap:

water 30
eggs 10
rice 5 bag
coffee 3in1 6
beer 10 cs
smokes 8 ctn
```

- 문장 하나에서 선명 MV SEA HERON, 국적 Panama, IMO, Western Anchorage, 선원 20명, 다음 기항지 Manila, 항해 4일을 뽑는다.
- 단위 없는 "water 30"은 제품에서 단위를 채워 Drinking water 30 CASE가 된다. "cs"는 CASE로 읽는다.
- "smokes"는 처음 보는 은어라 분류 제안으로 넘어가고, 담배(1일 40개비 한도)로 제안된다.
- 맥주 10 CASE = 240캔, 허용 320캔(20명 × 4일 × 4)으로 통과.
- 막는 것: 미분류 2줄, 선종 없음(주류·담배 공급 가능 여부를 판단 못 함), NRT 없음, 최종 기항지 없음. 항차·출항 일시는 경고만 한다. 발주 화면의 선박 카드에서 채우면 풀린다.

### 예시 3. IMPA 코드 표로 온 선장 청구서 — 허가 없이 끝난다

```text
IMPA   | DESCRIPTION                 | UNIT | QTY
000105 | RICE JASMINE 25KG           | BAG  | 12
000330 | DRINKING WATER 1.5L X 12    | CASE | 50
210301 | MOORING ROPE PP 40MM X 220M | COIL | 1
...
```

7줄 모두 IMPA 코드와 함께 읽고 규칙으로 바로 분류된다. 전부 세금 납부 선용품이라 TradeNet 허가가 필요 없고, 막는 항목 0개로 바로 확정 → 인도 → 월간 명세서로 간다.

### 예시 4. 선장이 직접 보낸 보세품 요청 — 한도 안이면 바로 신고

```text
Vessel: MT AMBER TIDE / product tanker / Bahamas flag / IMO 9702245 / NRT 8,140
Crew 25. Voyage 2643W, ETD 24 Oct 22:00, next port Kaohsiung (approx. 10 days), final port Ulsan.

36 BTL  Whisky 70cl
24 BTL  Red wine 75cl
20 CASE Beer 330ml
40 CTN  Cigarettes 200s
8 PAIL  Engine oil SAE40 20L
```

| 품목 | 요청 | 허용 (25명 × 10일) | TradeNet 내포장 수량 |
| --- | --- | --- | --- |
| 위스키 | 36병 | 62.5병 | 25.2 LTR |
| 와인 | 24병 | 62.5병 | 18 LTR |
| 맥주 | 480캔 | 1,000캔 | 158.4 LTR |
| 담배 | 8,000개비 | 10,000개비 | 8,000 STK |

전달 메일이고 수량이 품명 앞에 있어도 5줄을 모두 읽는다. 엔진오일(세금 미납 선용품)까지 OUT (APS) 허가 한 건으로 묶이고, 막는 항목 0개라 바로 확정할 수 있다.

### 3분 시연 순서

1. Orders → New order → "Mixed order with traps" → Read order
2. 펌프 부품: Suggest classification → 근거 확인 → Approve
3. Prepare declaration → 담배 초과 → Cut to 20 CTN
4. 신호탄 승인 체크 · 면허 번호 입력 → Confirm declaration
5. TradeNet 허가 신청서 → Export .xlsx · Print / PDF
6. Record delivery → Statements
7. 같은 메일을 다시 넣으면 AI 없이 규칙만으로 같은 결과

처음 상태로 되돌리기: Overview → Reset demo. 화면 언어는 상단 바의 EN / 한으로 바꾼다. 세관에 내는 TradeNet 시트·인쇄본과 월간 명세서는 언어와 관계없이 영어로 나간다.

## 싱가포르 현장 적용까지 남은 일

| 항목 | 지금 | 다음 |
| --- | --- | --- |
| TradeNet 제출 | 허가 신청서(헤더·당사자·출항 운송·품목, 원산지·내포장 수량·기관 면허 번호) · 엑셀 · 인쇄 | 주류 알코올 도수 등 품목별 세부 필드, 선언 대리인(declaring agent) 시스템 연동으로 직접 제출 |
| 통제 품목 | 데모 예시(신호탄 → SPF Arms & Explosives) | 실제 통제 품목·관할 기관 목록 반영 |
| 데이터 | 브라우저 저장 | 서버 DB, 회사·사용자 계정 |
| 고객 검증 | 가상 공급사 데이터 | 싱가포르 공급사 파일럿 |

## 개발

```bash
npm install
npm run dev
npm test
```

- `ANTHROPIC_API_KEY`가 있으면 로컬에서도 `/api/read`, `/api/propose`가 돈다(`claude-opus-5-5`, 구조화 출력, 거절 시 서버측 폴백). 없으면 내장 판독기와 키워드 제안으로 폴백하고 화면에 사유를 보여 준다.
- 데이터는 브라우저 저장(`bearing.v1`). 손대지 않은 데모는 오늘 날짜 기준으로 다시 만들어진다.
- 배포: Vercel(`vercel.json`), 환경변수 `ANTHROPIC_API_KEY`.

## 구조

| 경로 | 내용 |
| --- | --- |
| `src/sg.ts` | 싱가포르 규칙: 배급 한도, 승인 선박, 경로 분할, 제출 전 점검, 월간 명세서 |
| `src/engine.ts` | 규칙 매칭, 오프라인 메일 판독기 |
| `src/heuristics.ts` | 오프라인 분류 제안 |
| `src/i18n.ts` | 화면 문구 사전(영어·한국어), 언어 전환 |
| `src/tradenet.ts` | TradeNet 허가 신청서 모델 · 엑셀 시트 · 인쇄본(선장 인수 확인서 포함) |
| `src/pages/` | Overview, Orders, Order, Declaration, Delivery, Statements, Catalog, Rules |
| `api/` | Vercel 함수: `read`(메일 판독), `propose`(분류 제안) |

## 설계 문서

- [싱가포르 세관 모듈 설계](https://claude.ai/artifact/UEPF7vCoZxWvjMKWYx9sgi) (Claude Docs)
- [구현 계획](docs/PLAN.md)

## 가상 데이터

데모의 공급사·대리점·선박·허가 번호는 모두 가상이다(`Demo` 표기, `.demo` 도메인).
