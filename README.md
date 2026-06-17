# HANA-TECH MES (`mesnew`)

화장품 용기 조립·가공 생산 라인을 위한 웹 기반 **MES(Manufacturing Execution System)** 입니다.  
기준정보 등록부터 생산계획·작업지시·LOT 추적·현장 실적·재고·출하까지, 사무실과 현장이 같은 데이터를 공유하도록 설계했습니다.

| 구분 | 설명 |
|------|------|
| **대상 공정** | 화장품 용기 조립/가공 (다단계 공정, LOT 단위 추적) |
| **사용자** | 생산관리(사무실), 라인 작업자(현장), 라인장(전광판) |
| **형태** | 모노레포 — React SPA + Express REST API + MySQL |

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
- **작업 지시** — 계획 연결, 작업장·작업자 배정, 지시 수량 관리
- **생산 LOT** — 작업지시를 LOT 단위로 분할·추적 (잔여 배정 수량 관리)
- **자재 LOT** — 입고 자재 LOT·잔량 등록 및 재고 반영(IN)
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

레이아웃 없이 단독으로 열리는 화면:

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
| `workCenters`, `workers` | `/api/work-centers`, `/api/workers` |
| `defectTypes` | `/api/defect-types` |
| `mbomProcesses` | `/api/mbom-processes`, `/api/eboms` |
| `productionLots` | `/api/lots` |
| `inventoryItems` | `/api/inventories`, `/api/inventory-transactions` |
| `processResults` | `/api/process-results`, `/api/defect-histories` |
| `extendedMasters` | `/api/locations`, `/api/roles`, `/api/users`, `/api/notices` |
| `extendedOps` | `/api/production-plans`, `/api/work-orders`, `/api/material-lots`, `/api/shipments`, `/api/outsourcing`, `/api/barcodes`, `/api/lot-histories` … |
| `mesTransactions` | 재고·출하 등 트랜잭션 처리 |

헬스 체크: `GET /api/health` → `{ "ok": true, "time": "..." }`

---

## 데이터 모델

Prisma 스키마(`prisma/schema.prisma`)에 MES 전 도메인이 정의되어 있습니다.

| 도메인 | 주요 모델 |
|--------|-----------|
| 기준정보 | `Product`, `Customer`, `WorkCenter`, `Worker`, `Location`, `Role`, `User` |
| BOM·공정 | `Ebom`, `MbomProcess`, `MbomProcessMaterial`, `ProcessRouting` |
| 계획·실행 | `ProductionPlan`, `WorkOrder`, `WorkOrderWorker`, `ProductionLot`, `MaterialLot` |
| 실적·품질 | `ProcessResult`, `DefectType`, `DefectHistory`, `LotMaterialUsage`, `LotHistory` |
| 재고 | `Inventory`, `InventoryTransaction`, `InventorySnapshot` |
| 물류 | `Shipment`, `ShipmentDetail`, `Outsourcing`, `OutsourcingResult` |
| 운영 | `Barcode`, `AuditLog`, `SystemLog`, `VisionRawLog`, `Notice`, `ProductionStatus` |

품목(`Product`)은 생산·구매·품질·재고·외주 서브 테이블로 속성이 분리되어 있습니다.

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

- 기능 확장 및 UI 정리가 진행 중인 **개발 버전**입니다.
- 인증/권한은 역할·사용자 마스터가 있으나, API 단의 세션·JWT 가드는 환경에 따라 보완이 필요할 수 있습니다.
- 비전 로그(`VisionRawLog`) 등 설비 연동 필드는 수집·조회 위주로 구현되어 있습니다.

### git 제외 항목

- `node_modules/`, `dist/`
- `.env`, `.env.*`

---

## 라이선스

ISC (package.json 기준). 상용 배포 시 조직 정책에 맞게 조정하세요.
