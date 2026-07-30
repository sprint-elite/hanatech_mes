# HANA-TECH MES (`mesnew`)

화장품 용기 조립·가공 생산 라인을 위한 웹 기반 **MES(Manufacturing Execution System)** 입니다.  
기준정보 등록부터 생산계획·작업지시·LOT 추적·현장 실적·재고·출하까지, 사무실과 현장이 같은 데이터를 공유하도록 설계했습니다.

| 구분 | 설명 |
|------|------|
| **대상 공정** | 화장품 용기 조립/가공 (다단계 공정, LOT 단위 추적) |
| **사용자** | 생산관리(사무실), 라인 작업자(현장), 라인장(전광판) |
| **형태** | 모노레포 — React SPA + Express REST API + MySQL |
| **현재 버전** | **V1.3.2** |

---

## 목차

- [주요 기능](#주요-기능)
- [화면 구성](#화면-구성)
- [아키텍처](#아키텍처)
- [기술 스택](#기술-스택)
- [저장소 구조](#저장소-구조)
- [빠른 시작 (로컬 개발)](#빠른-시작-로컬-개발)
- [환경 변수](#환경-변수)
- [npm 스크립트](#npm-스크립트)
- [프로덕션 배포](#프로덕션-배포)
- [API 개요](#api-개요)
- [데이터 모델](#데이터-모델)
- [문서](#문서)
- [개발 현황](#개발-현황)
- [버전 이력](#버전-이력)

---

## 주요 기능

### 기준정보 (Master)

- **품목** — 완제품/반제품/자재, 생산·구매·품질·재고·외주 속성을 블록 단위로 관리
- **고객/업체** — 고객사·공급사·외주업체 구분
- **EBOM** — 완제품 1개당 투입 자재(레시피) 트리 구조
- **MBOM** — 제품별 공정 순서 및 공정별 투입 자재
- **작업장·작업자·불량유형·창고·위치** — 생산 실행에 필요한 마스터

### 계획·지시·LOT

- **생산 계획** — 기간·수량·품목 단위 계획 등록
- **작업 지시** — 계획 연결, 작업장·**공정별 작업자(M:N)** 배정, 지시 수량 관리
- **생산 LOT** — 작업지시를 LOT 단위로 분할·추적 (잔여 배정 수량 관리)
- **자재 LOT** — 입고 자재 LOT·잔량 등록, **CODE128 바코드**·썸네일·인쇄, 재고 반영(IN)
- **LOT 이력·자재 투입** — LOT 생명주기 및 투입 이력 조회

### 생산 실행·품질

- **통합 생산 운영** — 계획·지시·LOT·실적을 한 화면에서 탭 전환하며 운영
- **실적 등록** — 공정별 양품/불량 입력 (사무실용)
- **현장 입력** (`/worker-input`) — 모바일·태블릿 최적화 4단계 실적 입력
- **실적·불량 이력** — 공정 실적 및 불량 상세 조회
- **백플러시** — 실적 저장 시 EBOM 기준 자재 자동 출고 처리

### 재고·출하·외주

- **재고** — 품목별 재고 수량·추이
- **입출고 관리** — 재고 트랜잭션(IN/OUT/MOVE/ADJUST)
- **출하** — 출하 헤더·상세 등록
- **외주** — 외주 요청·출고·입고 실적
- **바코드** — 품목·LOT·자재LOT·위치·지시 바코드 마스터

### 운영·모니터링

- **대시보드** — 지시 완료율, 불량률, 지연·주의, 최근 실적 차트, 월별 일정
- **현장 전광판** (`/floor-board`) — 라인 상태 대형 스크린
- **감사 로그·시스템 로그·비전 로그** — 운영·설비 연동 이력
- **역할·사용자·공지** — 계정 및 공지 관리
- **밝은/어두운 모드** — 사이드메뉴 상단에서 테마 전환 (설정 localStorage 저장)

### 작업자·생산 효율 (V1.3.1 ~ V1.3.2)

- **작업자** (`/workers`) — 품목·공정별 실적, **작업시간(분)** 입력, 표준 대비 **작업효율** 표시
- **작업시간 상세** — 공정 실적을 **생산 LOT** 단위로 집계(계획·지시·LOT 번호 표시), LOT별 작업시간·**기여도(%)** 입력
- **통계 탭** — 품목/공정/작업자 필터, 개당 작업시간·효율 차트 (**전체 공정** 선택 시 작업자별 공정 합산 비교)
- **공정별 작업 배정** — 작업지시·통합운영에서 드래그/클릭으로 공정마다 작업자 다중 배정 (`WorkOrderProcessWorker`)
- **MBOM 공정** — 공정별 **배치 가능 인원(최소~최대)** 설정, 카드에 `인원 n~m명` 표시
- **최단 완료 자동 배정** — 묶음별 MBOM 인원 제약 반영, 결과 모달에 **지시 수량·완료 예상·예상 효율(%)** 표시
- **기여도 반영** — 동일 공정 다인 작업 시 기여도에 따라 효율·실적 집계 (`contributionPct`)
- **현장 입력** — 로그인 계정이 아닌 **작업지시에 배정된 작업자 전원**에게 동일 실적 반영

### ERP (V1.1)

사이드메뉴 **ERP** 그룹에 아래 4개 화면이 있습니다.

| 메뉴 | 경로 | 상태 |
|------|------|------|
| 업무일지 | `/erp/work-logs` | **완료** — 일자별 업무 기록·상태·칸반 |
| 지출결의서 | `/erp/expense-reports` | **완료** — 신청·2단계 승인·영수증·A4 조회·인쇄 |
| **연차관리** | `/erp/annual-leave` | **완료** — 캘린더·목록·2단계 승인·A4 연차신청서 |
| **일정관리** | `/erp/schedules` | **완료** — 캘린더·칸반·주말/공휴일 표시 |

- **연차관리**: 잔여 연차 조회, 신청, 실장/대표 2단계 승인·반려·승인취소·반려취소, A4 연차신청서 보기·인쇄
- **일정관리**: 관리자(실장/대표/최고관리자) 일정 CRUD, 캘린더·우측 일정·하단 칸반(예정/진행/완료/보류), 지연·기한초과 알림

### 급여 (V1.2)

사이드메뉴 **급여** 그룹 (ERP와 별도) — eCount 스타일 급여 마스터·명세·자동 계산.

| 메뉴 | 경로 | 설명 |
|------|------|------|
| **수당항목** | `/payroll/allowance-items` | 수당 마스터 (고정/시간/일, 배율, 비과세) |
| **공제항목** | `/payroll/deduction-items` | 공제 마스터 (산출 공식·설명) |
| **직원정보** | `/payroll/employee-profiles` | 기본급·통상임금·부양가족·급여대상 |
| **근무입력** | `/payroll/work-records` | 일자·사원·수당항목별 근무기록 (시간/일) |
| **급여명세서** | `/payroll/pay-stubs` | 월 배치·자동 계산·발행·명세 조회 |

- **자동 계산**: 직원정보 + 근무입력 + 수당/공제 항목 기준으로 명세 생성 (`전체 자동 계산`, 건별 `재계산`)
- **급여명세표**: 수당·공제 항목별 지급유형·근무기록·배율·산출방법 상세 조회, 인쇄
- **Excel**: 개인 **급여명세표**, 월별 **급여대장** 내보내기 (`xlsx`)
- **4대보험 (2026)**: 국민연금 4.75%, 건강 3.595%, 장기요양 13.14%, 고용 0.9%, 기준소득월액 상·하한(637만/40만), 건강·장기요양 원 단위 절사
- 기본급은 **월 고정** (일할 계산 없음), 연장·야간·휴일은 통상시급(통상임금÷209) × 시간 × 배율
- 시드: `npx tsx scripts/seed-payroll-items.ts` (기본 수당·공제 7+6건)

> `/erp/pay-stubs` → `/payroll/pay-stubs` 로 리다이렉트

### MBOM 공정분석 (V1.1)

- 공정별 **표준시간(초)**, **기준수량**, **비고** 필드 추가 (`Decimal(14,4)` 초 단위)
- MBOM 화면·등록 모달에서 입력·표시

### 인증·권한 (V1.1)

- **로그인 화면** (`/login`) 및 `X-Sys-User` 헤더 기반 API 사용자 식별
- ERP 연차·일정·급여: **실장/대표/최고관리자** 관리 권한, **직원**은 본인 데이터 조회

---

## 화면 구성

사이드메뉴는 아코디언 그룹으로 구성됩니다.

| 메뉴 그룹 | 경로 예시 | 설명 |
|-----------|-----------|------|
| 운영 | `/`, `/integrated-ops` | 대시보드, 통합 생산 운영 |
| 기준정보 | `/products`, `/ebom`, `/mbom` … | 마스터 데이터 |
| 계획·지시 | `/production-plans`, `/work-orders` | 계획·지시 |
| 생산·LOT | `/lots`, `/worker-input`, `/process-result` … | LOT·실적 |
| 재고·출하·외주 | `/inventory`, `/shipments` … | 물류 |
| 시스템 | `/users`, `/audit-logs` … | 계정·로그 |
| **ERP** | `/erp/annual-leave`, `/erp/schedules` … | 연차·일정 |
| **급여** | `/payroll/allowance-items`, `/payroll/pay-stubs` … | 수당·공제·직원·근무·명세 |

레이아웃 없이 단독으로 열리는 화면:

- `/login` — 로그인

- `/worker-input` — 현장 작업자 실적 입력
- `/floor-board` — 라인 전광판

---

## 아키텍처

```text
┌─────────────┐     /api/*      ┌──────────────────┐     Prisma      ┌─────────┐
│  React SPA  │ ──────────────► │  Express API     │ ──────────────► │  MySQL  │
│  (Vite)     │                 │  (port 4000)     │                 │ mesnew  │
└─────────────┘                 └──────────────────┘                 └─────────┘
       ▲
       │ 정적 파일 (프로덕션: nginx 등)
```

- **개발**: Vite dev server(`5173`)가 `/api`를 Express(`4000`)로 프록시
- **프로덕션**: 프론트는 `dist/` 정적 배포, API는 Node 프로세스(PM2 등)로 실행

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19, React Router 7, TypeScript, Vite 7 |
| Backend | Express 5, TypeScript, Zod(요청 검증) |
| Database | MySQL / MariaDB, Prisma ORM 6 |
| Build | tsup(서버 번들), concurrently(동시 dev) |
| Runtime | Node.js 20+ 권장 |

---

## 저장소 구조

```text
mesnew/
├── src/
│   ├── client/                 # 프론트엔드 (Vite + React)
│   │   ├── pages/              # 화면별 페이지 컴포넌트 (34개)
│   │   ├── ui/                 # App, Layout, 공통 UI
│   │   ├── lib/                # API 클라이언트, 테마 등
│   │   ├── styles.css          # 전역·MES 셸 스타일
│   │   └── main.tsx
│   └── server/
│       ├── index.ts            # Express 진입점
│       ├── routes/             # REST API 라우터
│       │   ├── products.ts
│       │   ├── extendedOps.ts  # 계획·지시·출하·외주·LOT 이력 등
│       │   ├── processResults.ts
│       │   ├── mesTransactions.ts
│       │   └── …
│       ├── lib/                # 백플러시·에러 처리 등
│       └── db/prisma.ts
├── prisma/
│   ├── schema.prisma           # 전체 도메인 스키마 (~40 모델)
│   └── init-mesnew-database.sql
├── dist/                       # 빌드 산출물 (git 제외)
│   ├── index.html + assets/    # 프론트
│   └── server/index.js         # API 번들
├── GUIDE.md                    # 사용자 가이드 (사무실·연습)
├── WORKER-QUICK.md             # 현장 작업자 1페이지 안내
├── package.json
├── vite.config.ts
└── tsup.config.ts
```

---

## 빠른 시작 (로컬 개발)

### 사전 요구사항

- **Node.js 20+**
- **MySQL 8** 또는 **MariaDB 10.6+**

### 1. 의존성 설치

```bash
npm install
```

### 2. 데이터베이스 생성

```sql
CREATE DATABASE IF NOT EXISTS mesnew
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

동일 스크립트: `prisma/init-mesnew-database.sql`

### 3. 환경 변수

```bash
cp .env.example .env
```

`.env` 예시:

```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/mesnew"
PORT=4000
```

### 4. 스키마 반영

```bash
npm run prisma:generate
npm run prisma:push
```

### 5. 개발 서버 실행

```bash
npm run dev
```

| 서비스 | URL |
|--------|-----|
| 웹 UI | http://localhost:5173 |
| API | http://localhost:4000 |
| Health | `GET http://localhost:4000/api/health` |

Prisma Studio로 DB 확인: `npm run prisma:studio`

---

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `DATABASE_URL` | O | MySQL 연결 문자열 |
| `PORT` | - | API 포트 (기본 `4000`) |

`.env` 파일은 git에 포함되지 않습니다 (`.gitignore`).

---

## npm 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 프론트(5173) + API(4000) 동시 실행 |
| `npm run dev:web` | Vite만 실행 |
| `npm run dev:api` | API만 실행 (watch) |
| `npm run build` | `dist/`에 프론트 빌드 + 서버 번들 |
| `npm run deploy` | 빌드 후 `/var/www/mesnew/dist/`에 프론트 정적 파일 동기화 |
| `npm run start` | 프로덕션 API 실행 (`dist/server/index.js`) |
| `npm run prisma:generate` | Prisma Client 생성 |
| `npm run prisma:push` | 스키마를 DB에 반영 |
| `npm run prisma:migrate` | 마이그레이션 개발 모드 |
| `npm run prisma:studio` | DB GUI |
| `npm run lint` | ESLint |

---

## 프로덕션 배포

빌드 후 **프론트 정적 파일**과 **API 프로세스**를 각각 배포합니다.  
`npm run build`만 하고 API만 재시작하면 **화면이 갱신되지 않습니다** — 정적 파일도 함께 배포해야 합니다.

### 1. 빌드

```bash
npm run build
```

산출물:

- `dist/index.html`, `dist/assets/*` — 웹 UI
- `dist/server/index.js` — API 번들

### 2. API 실행 (예: PM2)

```bash
npm run start
# 또는
pm2 start dist/server/index.js --name mesnew-api
```

### 3. 웹 정적 파일 (예: nginx)

`dist/` 내용을 웹 서버 document root에 복사하고, `/api`는 API 포트로 reverse proxy 합니다.

```nginx
# 예시
location / {
    root /var/www/mesnew/dist;
    try_files $uri $uri/ /index.html;
}
location /api/ {
    proxy_pass http://127.0.0.1:4000;
}
```

배포 후 UI 반영 예시:

```bash
sudo rsync -av --delete ./dist/ /var/www/mesnew/dist/
pm2 restart mesnew-api
```

---

## API 개요

모든 API는 `/api` 접두사를 사용합니다. JSON 요청/응답.

| 라우터 | 주요 엔드포인트 |
|--------|-----------------|
| `products` | `GET/POST/PATCH/DELETE /api/products` |
| `customers` | `/api/customers` |
| `workCenters`, `workers` | `/api/workers`, `/api/workers/:id/product-summary`, `process-work-time-entries`, `stats/comparison` |
| `processWorkerAssign` | `POST /api/process-worker-assignments/optimize` — 공정 묶음·지시수량 기준 최단 완료 배정 |
| `defectTypes` | `/api/defect-types` |
| `mbomProcesses` | `/api/mbom-processes`, `/api/eboms` |
| `productionLots` | `/api/lots` |
| `inventoryItems` | `/api/inventories`, `/api/inventory-transactions` |
| `processResults` | `/api/process-results`, `/api/defect-histories` |
| `extendedMasters` | `/api/locations`, `/api/roles`, `/api/users`, `/api/notices` |
| `extendedOps` | `/api/production-plans`, `/api/work-orders`, `/api/material-lots` (바코드 이미지 포함), `/api/shipments`, `/api/outsourcing`, `/api/barcodes`, `/api/lot-histories` … |
| `auth` | `POST /api/auth/login` — 로그인 |
| `annualLeave` | `/api/annual-leave/*` — 연차 잔여·신청·승인·캘린더 |
| `erpSchedules` | `/api/erp-schedules` — ERP 일정 CRUD·상태 변경 |
| `payStubs` | `/api/pay-stubs/*` — 급여 배치·명세·자동 계산·상세·급여대장 |
| `payrollItems` | `/api/payroll/allowance-items`, `/api/payroll/deduction-items` |
| `payrollEmployees` | `/api/payroll/employee-profiles`, `/api/payroll/work-records` |
| `smartFactoryLog` | 스마트공장 로그 수집 API |
| `mesTransactions` | 재고·출하 등 트랜잭션 처리 |

헬스 체크: `GET /api/health` → `{ "ok": true, "time": "..." }`

---

## 데이터 모델

Prisma 스키마(`prisma/schema.prisma`)에 MES 전 도메인이 정의되어 있습니다.

| 도메인 | 주요 모델 |
|--------|-----------|
| 기준정보 | `Product`, `Customer`, `WorkCenter`, `Worker`, `Location`, `Role`, `User` |
| BOM·공정 | `Ebom`, `MbomProcess`, `MbomProcessMaterial`, `ProcessRouting` |
| 계획·실행 | `ProductionPlan`, `WorkOrder`, `WorkOrderWorker`, `WorkOrderProcessWorker`, `ProductionLot`, `MaterialLot` |
| 실적·품질 | `ProcessResult`, `DefectType`, `DefectHistory`, `LotMaterialUsage`, `LotHistory` |
| 재고 | `Inventory`, `InventoryTransaction`, `InventorySnapshot` |
| 물류 | `Shipment`, `ShipmentDetail`, `Outsourcing`, `OutsourcingResult` |
| 운영 | `Barcode`, `AuditLog`, `SystemLog`, `VisionRawLog`, `Notice`, `ProductionStatus` |
| ERP (V1.1) | `AnnualLeaveBalance`, `AnnualLeaveRequest`, `ErpSchedule`, `PayStubRun`, `PayStub`, `PayStubLine` |
| 급여 (V1.2) | `PayAllowanceItem`, `PayDeductionItem`, `PayEmployeeProfile`, `PayWorkRecord` |

품목(`Product`)은 생산·구매·품질·재고·외주 서브 테이블로 속성이 분리되어 있습니다.

연차 데모 계정 시드: `npx tsx scripts/seed-annual-leave-demo.ts`  
급여 수당·공제 기본항목 시드: `npx tsx scripts/seed-payroll-items.ts`

---

## 문서

| 문서 | 대상 | 내용 |
|------|------|------|
| **[사용설명서.md](./사용설명서.md)** | **사무실·현장·라인 (비개발자)** | **매일 쓰는 방법**, 역할별 업무, 문제 해결 |
| [시연안내.md](./시연안내.md) | **발표·데모** | 시연 순서, 말할 내용, 20분/10분 코스 |
| [GUIDE.md](./GUIDE.md) | 사무실·관리자 | 메뉴별 기능 설명, **처음 따라하기 연습 시나리오** |
| [WORKER-QUICK.md](./WORKER-QUICK.md) | 현장 작업자 | `/worker-input` 4단계 실적 입력 (1페이지) |

개발자는 이 README와 `prisma/schema.prisma`, `src/server/routes/`를 함께 보면 전체 흐름을 파악할 수 있습니다.

---

## 개발 현황

- **V1.3.2** 기준: **자재 LOT 바코드**, **자동 배정 예상 효율**, **작업자 통계(전체 공정 합산)**, **기여도**, ERP 고아 데이터 방어. **V1.3.1** — 공정별 배정·자동 배정·LOT 작업시간. **V1.3.0** — ERP·급여·목록 UI·생산 LOT 바코드 등.
- 인증은 로그인 화면 + `X-Sys-User` 헤더 방식이며, JWT/세션 쿠키는 추후 보완 가능합니다.
- 스키마 반영: `npm run prisma:push` (또는 `prisma migrate deploy`). Prisma Client 변경 후 **`npm run prisma:generate`** 및 API 재시작 필요.
- 비전 로그(`VisionRawLog`) 등 설비 연동 필드는 수집·조회 위주로 구현되어 있습니다.

---

## 버전 이력

### V1.3.2 (2026-07-30)

**자재 LOT 바코드 · 자동 배정 · 통계 · 기여도**

- DB: `MaterialLot.barcode`, `WorkerProcessWorkTimeEntry.contributionPct`
- **자재 LOT** 목록 바코드 썸네일·이미지 API (`/api/material-lots/:id/barcode-image`), 백필: `scripts/backfill-material-lot-barcodes.ts`
- **자동 배정 결과** 모달: 지시 수량·완료 예상·**예상 효율(%)** (파이프라인 메이크스팬 기준)
- **작업자 통계**: 전체 공정 선택 시 작업자별 공정 합산(초/개·효율), 불필요 차트(시간당 양품·비교 요약) 제거
- **기여도(%)** 입력 시 효율·실적 집계 반영 (`workerContribution.ts`)
- **지출결의서·연차**: 삭제된 사용자 고아 데이터 조회 오류 방어, 정리 스크립트 `scripts/cleanup-orphan-requests.ts`
- 자동 배정 검증: `scripts/verify-worker-optimize.ts`

### V1.3.1 (2026-07-29)

**공정별 작업 배정 · 생산 효율**

- DB: `MbomProcess.min_workers` / `max_workers` (기본 1)
- DB: `WorkOrderProcessWorker`, `WorkerProcessWorkTimeEntry.productionLotId`
- 작업지시 **공정별 작업자** M:N UI (`WorkOrderProcessWorkerAssign`, 통합운영·작업지시 모달)
- `process_result` 현장 등록 시 **배정 작업자 전원** 동일 수량 반영 (`processResults.ts`)
- 작업자 **LOT별 작업시간** API·모달, 공정별 효율(초/개·%)
- **최단 완료 자동 배정**: 묶음 설정 모달 → 최적화 API → 결과 확인 모달
- 운영 데이터 초기화: `scripts/run-wipe-mes-ops-data.mjs`

### V1.3.0 (2026-07-21)

**목록 UI 통일 (mesList 셸)**

- 생산계획·작업지시·생산/자재 LOT·LOT이력·자재투입·공정이력·재고·입출고·출하·외주·바코드·역할·사용자·공지 등 목록 페이지를 품목 페이지와 동일한 헤더·필터·통계·페이징 셸로 정리
- 공유 스타일: `src/client/list-page.css`, 페이지별 `*-page.css`
- 출하 목록 컬럼 간격 깨짐 수정 (`td` flex 제거, `table-layout: fixed` + `colgroup`)
- ERP·급여 화면은 헤더/토큰 톤만 수렴 (대시보드·통합운영·현장입력은 제외)

**생산 LOT 바코드**

- `ProductionLot.barcode` 필드 및 CODE128 이미지 API (`/api/lots/:id/barcode-image?view=thumb|screen|print`)
- 생산 LOT 목록 썸네일·미리보기 모달, **인쇄하기** (203dpi Zebra 라벨)
- LOT 스캔 조회 화면 (`/lot-scan`)
- 기존 LOT 바코드 백필 스크립트: `scripts/backfill-production-lot-barcodes.ts`

**사용자 관리**

- 작업자 연결: ID 직접 입력 → **작업자명 셀렉트**
- 등록된 사용자 **수정** (`PATCH /api/users/:id`), 비밀번호는 변경 시에만 입력

**ERP · 업무일지 · 지출결의서**

- DB: `ErpWorkLog`, `ExpenseReport`, `ExpenseReportLine`
- 업무일지: 일자·제목·내용·상태 CRUD, 칸반
- 지출결의서: 다건 내역·영수증 첨부, 실장/대표 2단계 승인, A4 조회·인쇄

**급여 보완**

- 근무입력을 **일자·사원·수당항목별 행** (`PayWorkRecordLine`)으로 확장
- 직원정보: 국민연금 기준소득월액, 8~20세 자녀 수, 원천징수율(80/100/120%)
- **2026.03 간이세액표** 반영 (`payrollWithholding.ts`, `scripts/import-withholding-table.ts`)

**대시보드**

- 작업지시 칸반 영역 **작업지시 관리·필터** 버튼 제거

### V1.2.0 (2026-06-29)

**급여 메뉴 · 마스터**

- 사이드메뉴 **급여** 그룹 추가 (수당항목, 공제항목, 직원정보, 근무입력, 급여명세서)
- DB: `PayAllowanceItem`, `PayDeductionItem`, `PayEmployeeProfile`, `PayWorkRecord`
- API: `payrollItems`, `payrollEmployees`, `payStubs` 확장
- 기본 수당·공제 시드: `scripts/seed-payroll-items.ts`

**급여 자동 계산**

- 직원정보 + 월별 근무입력 + 수당/공제 항목명·배율 기반 명세 자동 생성
- 통상시급 = 통상임금 ÷ 209, 연장·야간·휴일 = 통상시급 × 시간 × 배율
- 기본급 월 고정, 식대·차량유지비 비과세(각 20만 한도)
- `전체 자동 계산` / 건별 `재계산`, 근무입력 없을 시 자동 초기화

**급여명세서 UI · Excel**

- eCount 스타일 **급여명세표** 상세 조회 (지급유형, 근무기록, 산출방법)
- **급여대장** / 개인 **급여명세표** Excel 내보내기 (`xlsx`)
- 공제항목 표 컬럼을 수당항목 표와 세로선 정렬
- `/erp/pay-stubs` → `/payroll/pay-stubs` 리다이렉트

**4대보험 2026 요율**

- `payrollRates.ts`: 국민연금 4.75%, 건강 3.595%, 장기요양 13.14%, 고용 0.9%
- 기준소득월액 상한 637만·하한 40만, 건강·장기요양 원 단위 절사

### V1.1.0 (2026-06-25)

**MBOM · 공정분석**

- `MbomProcess`: `standardTime`(초), `baseQty`, `remark` 필드 추가
- MBOM API·화면·등록 모달 반영

**ERP 메뉴 · 연차관리**

- ERP 사이드메뉴 5개 화면 라우팅
- 연차 잔여/신청/목록/캘린더 UI
- 실장·대표 2단계 승인, 반려 사유, 승인취소·반려취소
- A4 연차신청서 보기·인쇄 (`LeaveApplicationSheet`)
- DB: `AnnualLeaveBalance`, `AnnualLeaveRequest`
- 데모 시드: `scripts/seed-annual-leave-demo.ts`

**ERP · 일정관리**

- 관리자 일정 CRUD, 캘린더 + 우측 일정 + 칸반(드래그 상태 변경)
- 종일/시간 일정, 지연·기한초과 배지, 한국 공휴일(2025–2027)
- DB: `ErpSchedule`

**ERP · 급여명세서**

- 월별 배치(작성중/발행), 직원별 지급·공제 항목, 실지급 자동 계산
- 관리자 등록·발행, 직원 발행분 조회·A4 인쇄
- DB: `PayStubRun`, `PayStub`, `PayStubLine`

**UI · 인증 · 기타**

- 로그인 페이지, 클라이언트 auth 유틸, `requestUser` (API 사용자·권한)
- 기준정보 페이지별 CSS·FormModal 분리 (품목, 고객, MBOM, 작업자 등)
- 대시보드·통합운영 UI 정리
- 스마트공장 로그 수집 미들웨어·API
- `npm run deploy` 스크립트 추가

### V1.0.0

- MES 초기 버전 (기준정보, 계획·지시·LOT, 실적, 재고, 대시보드 등)

### git 제외 항목

- `node_modules/`, `dist/`
- `.env`, `.env.*`

---

## 라이선스

ISC (package.json 기준). 상용 배포 시 조직 정책에 맞게 조정하세요.
