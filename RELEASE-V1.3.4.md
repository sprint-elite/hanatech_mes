# HANA-TECH MES — V1.3.4 릴리스 노트

**릴리스 일자:** 2026-08-04

---

## 요약

**당일 생산 손익**·**생산 원가 기준** 화면을 추가하고, 입고단가·품목 바코드·사용자/결재 서명 등 원가·기준정보·ERP 연동을 보강했습니다. 매출 구성 차트는 흑자 시 손익 조각 분리, 적자 시 빗금 오버레이로 손실을 표시합니다.

---

## 당일 생산 손익 (`/production-daily-pl`)

- 당일 생산 실적·작업시간·원가 기준을 합산한 **품목별 예상 손익**
- 요약 카드: 양품·생산시간·매출·총비용·손익
- **일별 손익 추이** 차트 (1개당 손익, 기간 조회)
- **매출 구성** 원형 차트
  - 흑자: 자재비·인건비·고정비·제품원가 + **손익**(본체에서 살짝 분리)
  - 적자: 비용 항목 100% 도넛 + **손실** 구간 **빨간 빗금** 오버레이 (총비용 대비 %)
- 품목 행 클릭 시 산정식·비용 구성 상세 모달

**API**

- `GET /api/production-daily-pl?date=`
- `GET /api/production-daily-pl/trend?from=&to=`

**모듈**

- `src/client/pages/ProductionDailyPlPage.tsx`
- `src/client/production-pl-page.css`
- `src/server/lib/productionDailyPl.ts`
- `src/server/routes/productionDailyPl.ts`

---

## 생산 원가 기준 (`/production-cost-basis`)

- 초당 입률·고정입률·제품원가·판매단가 등 **원가 산정 기준** 관리
- EBOM 기준 자재비 합산·실투입 대비 안내
- 당일 생산 손익 계산에 기준값 연동

**API / 모듈**

- `GET/PUT` 등 `/api/production-cost-basis` (`src/server/routes/productionCostBasis.ts`)
- `src/server/lib/productCostCalc.ts`
- `src/client/pages/ProductionCostBasisPage.tsx`
- 마이그레이션: `prisma/migrations/20260803180000_production_cost_basis`

---

## 입고단가 · 재고 단가

- 입고 시 **단위 단가** 반영 (`inbound_unit_price` 마이그레이션)
- 재고/입출고·원가 계산에 단가 유틸 사용 (`inventoryUnitCost.ts`)

---

## 품목 바코드

- 품목 CODE128 바코드 생성·표시·인쇄 연동 보강
- `src/server/lib/barcode/product.ts`
- 백필: `scripts/backfill-product-barcodes.ts`

---

## 사용자 · ERP 결재

- 사용자: 부서·직책·서명·사업팀·주소 등 프로필 필드
- 지출결의서·연차 신청 **결재 서명** UI (`ApprovalSignature.tsx`)
- 관련 마이그레이션
  - `20260803120000_user_dept_position`
  - `20260803140000_user_signature`
  - `20260803160000_user_business_team_address`

---

## 기타 UI·운영 개선

- 공지·역할·사용자·입출고·LOT 스캔 조회·통합운영 등 목록/모달 UX 보강
- 공정실적 집계 유틸 보강 (`processResultAgg.ts`)

---

## 배포

```bash
cd /home/ec2-user
npm run prisma:generate   # 스키마 변경 시
# 필요 시: npx prisma migrate deploy
npm run deploy            # 프론트 → /var/www/mesnew/dist/
pm2 restart mesnew-api    # API 재시작
```

> `pm2 restart`만으로는 **화면이 갱신되지 않습니다.** `npm run deploy`로 정적 파일도 함께 배포하세요.

---

## 주요 변경 파일

| 구분 | 경로 |
|------|------|
| 당일 손익 UI | `src/client/pages/ProductionDailyPlPage.tsx` |
| 원가 기준 UI | `src/client/pages/ProductionCostBasisPage.tsx` |
| 손익·원가 API | `src/server/routes/productionDailyPl.ts`, `productionCostBasis.ts` |
| 손익·원가 로직 | `src/server/lib/productionDailyPl.ts`, `productCostCalc.ts` |
| 스타일 | `src/client/production-pl-page.css` |
| 라우팅·메뉴 | `src/client/ui/App.tsx`, `Layout.tsx` |
| 스키마 | `prisma/schema.prisma`, `prisma/migrations/20260803*` |
