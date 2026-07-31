# HANA-TECH MES — V1.3.3 릴리스 노트

**릴리스 일자:** 2026-07-31

---

## 요약

생산·자재 LOT **150×100mm 라벨 인쇄**(Zebra ZD421 ZPL + 브라우저 폴백), **LOT 스캔 조회**에 자재 LOT 지원, **현장 입력** 다국어(한/영/베트남어) UI를 추가했습니다.

---

## LOT 라벨 인쇄 (150×100mm)

### 생산 LOT (`/lots`)

- 바코드 클릭 시 **바코드만**이 아닌 **전체 라벨** 인쇄
- 표시 항목: 생산 LOT, 품목, 수량, 등록일시, 생산일, CODE128 바코드, 하단 **(주)하나테크**
- 더블클릭: 라벨 미리보기 (기존과 동일)

### 자재 LOT (`/material-lots`)

- 생산 LOT와 동일한 **150×100mm** 라벨 형식
- 표시 항목: 자재 LOT, 품목명, 입고일자, 입고수량, 잔여수량, CODE128 바코드
- 바코드 클릭: 인쇄 / 더블클릭: 미리보기

### 인쇄 기술

| 항목 | 내용 |
|------|------|
| 라벨 크기 | 150×100mm (ZD421 203dpi, 1198×799px 캔버스) |
| 바코드 | `CODE128_LABEL` — scale 3, height 18mm |
| Zebra | Browser Print ZPL 전송 (`zplPrint.ts`) |
| 폴백 | ZPL 실패 시 PNG 브라우저 인쇄 |
| 품질 | 흑백 이진화(`binarizeLabelCanvas`)로 열전사 선명도 개선 |

**공유 모듈**

- `src/client/lib/labelPrintProfile.ts` — 라벨 규격·DPI·mm→px 변환
- `src/client/lib/printBarcode.ts` — `printProductionLotLabel`, `printMaterialLotLabel`
- `src/client/lib/zplPrint.ts` — Zebra Browser Print 연동

**API**

- `GET /api/lots/:id/barcode-image?view=label`
- `GET /api/material-lots/:id/barcode-image?view=label`

---

## LOT 스캔 조회 (`/lot-scan`)

- 기존: 생산 LOT만 조회
- **추가:** 자재 LOT 바코드/LOT번호 스캔 시 자재 LOT 정보 모달 표시
- 조회 순서: 생산 LOT → (없으면) 자재 LOT
- 자재 LOT 모달: 상태, 입고/잔여 수량, 입고일자, 공급업체, **생산 투입 이력**, 재고·재고 이력

**API**

- `GET /api/material-lots/lookup?value={스캔값}`

---

## 현장 입력 다국어 (`/worker-input`)

- 화면 상단 **언어 선택** (한국어 / English / Tiếng Việt)
- 4단계 실적 입력 UI 문구 i18n 적용
- 모듈: `src/client/i18n/WorkerInputI18n.tsx`, `workerInput.ts`

---

## 배포

```bash
cd /home/ec2-user
npm run build
npm run deploy          # 프론트 → /var/www/mesnew/dist/
pm2 restart mesnew-api  # API 재시작
```

> `pm2 restart`만으로는 **화면이 갱신되지 않습니다.** `npm run deploy`로 정적 파일도 함께 배포하세요.

---

## 변경 파일 (주요)

| 구분 | 경로 |
|------|------|
| 라벨 인쇄 | `src/client/lib/printBarcode.ts`, `labelPrintProfile.ts`, `zplPrint.ts` |
| 생산 LOT | `src/client/pages/LotsPage.tsx` |
| 자재 LOT | `src/client/pages/MaterialLotsPage.tsx` |
| 스캔 조회 | `src/client/pages/LotScanLookupPage.tsx` |
| 현장 입력 | `src/client/pages/WorkerInputPage.tsx`, `src/client/i18n/*` |
| API | `src/server/routes/productionLots.ts`, `extendedOps.ts` |
| 바코드 | `src/server/lib/barcode/image.ts` (`CODE128_LABEL`) |

---

## 이전 버전

- [V1.3.2](./README.md#v132-2026-07-30) — 자재 LOT 바코드, 자동 배정 예상 효율, 작업자 통계·기여도
