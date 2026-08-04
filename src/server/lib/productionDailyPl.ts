import { prisma } from '../db/prisma'
import { dedupeProcessResultsByProductionLot } from './processResultAgg'
import { getGlobalCostBasis, rollupMaterialUnitCost, serializeCostBasis } from './productCostCalc'
import { dec } from './inventoryUnitCost'

export type DailyPlWarning = {
  code: string
  message: string
  productId?: number
}

export type DailyPlProductRow = {
  productId: number
  productCode: string
  productName: string
  itemType: string
  unit: string
  goodQty: number
  inputQty: number
  defectQty: number
  workMinutes: number
  materialCost: number
  laborCost: number
  fixedCost: number
  productUnitCostTotal: number
  totalCost: number
  revenue: number
  profit: number
  laborRatePerSec: number | null
  fixedRatePerSec: number | null
  sellingPriceUnit: number | null
  productUnitCostPerUnit: number | null
  materialStandardUnitCost: number | null
  materialQtyBasis: number
  warnings: string[]
}

export type DailyPlTotals = {
  goodQty: number
  workMinutes: number
  materialCost: number
  laborCost: number
  fixedCost: number
  productUnitCostTotal: number
  totalCost: number
  revenue: number
  profit: number
}

export type DailyPlResult = {
  date: string
  products: DailyPlProductRow[]
  totals: DailyPlTotals
  warnings: DailyPlWarning[]
}

export function todayKstYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

function nextYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + 1))
  return dt.toISOString().slice(0, 10)
}

/** KST 일자 기준 실적·작업시간 조회 범위 */
export function kstDayBounds(ymd: string): {
  start: Date
  end: Date
  workDateGte: Date
  workDateLt: Date
} {
  const start = new Date(`${ymd}T00:00:00+09:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  // WorkerProcessWorkTimeEntry.workDate는 @db.Date → UTC 자정으로 저장됨
  const workDateGte = new Date(`${ymd}T00:00:00.000Z`)
  const workDateLt = new Date(`${nextYmd(ymd)}T00:00:00.000Z`)
  return { start, end, workDateGte, workDateLt }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

type EffectiveBasis = {
  materialUnitCost: number | null
  productUnitCost: number | null
  sellingPrice: number | null
  laborRatePerSec: number | null
  fixedRatePerSec: number | null
}

async function loadEffectiveBasisMap(productIds: number[]): Promise<Map<number, EffectiveBasis>> {
  if (productIds.length === 0) return new Map()

  const globalBasis = await getGlobalCostBasis()
  const global = serializeCostBasis(globalBasis)

  const [productRows, basisRows] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        materialUnitCost: true,
        purchaseProfile: { select: { purchasePrice: true } },
      },
    }),
    prisma.productionCostBasis.findMany({
      where: { basisType: 'PRODUCT', productId: { in: productIds } },
    }),
  ])

  const basisByProduct = new Map(basisRows.map((b) => [b.productId!, b]))
  const out = new Map<number, EffectiveBasis>()

  for (const p of productRows) {
    const basis = basisByProduct.get(p.id)
    const basisSer = basis ? serializeCostBasis(basis) : null
    const cachedMaterial = dec(p.materialUnitCost)
    const purchasePrice = dec(p.purchaseProfile?.purchasePrice ?? null)

    out.set(p.id, {
      materialUnitCost: basisSer?.materialUnitCost ?? cachedMaterial ?? purchasePrice,
      productUnitCost: basisSer?.productUnitCost ?? null,
      sellingPrice: basisSer?.sellingPrice ?? null,
      laborRatePerSec: basisSer?.laborRatePerSec ?? global.laborRatePerSec,
      fixedRatePerSec: basisSer?.fixedRatePerSec ?? global.fixedRatePerSec,
    })
  }

  return out
}

async function buildMaterialUnitPriceCache(materialLotIds: number[], materialProductIds: number[]) {
  const lotPrice = new Map<number, number | null>()
  const productPrice = new Map<number, number | null>()

  const lots =
    materialLotIds.length > 0
      ? await prisma.materialLot.findMany({
          where: { id: { in: materialLotIds } },
          select: { id: true, unitPrice: true, productId: true },
        })
      : []

  const allProductIds = new Set(materialProductIds)
  for (const lot of lots) {
    lotPrice.set(lot.id, dec(lot.unitPrice))
    allProductIds.add(lot.productId)
  }

  if (allProductIds.size > 0) {
    const products = await prisma.product.findMany({
      where: { id: { in: [...allProductIds] } },
      select: {
        id: true,
        materialUnitCost: true,
        purchaseProfile: { select: { purchasePrice: true } },
      },
    })
    for (const p of products) {
      productPrice.set(p.id, dec(p.materialUnitCost) ?? dec(p.purchaseProfile?.purchasePrice ?? null))
    }
  }

  for (const lot of lots) {
    if (lotPrice.get(lot.id) == null) {
      lotPrice.set(lot.id, productPrice.get(lot.productId) ?? 0)
    }
  }

  return { lotPrice, productPrice }
}

function resolveUsageUnitPrice(
  materialLotId: number | null,
  materialProductId: number | null,
  lotPrice: Map<number, number | null>,
  productPrice: Map<number, number | null>,
): number {
  if (materialLotId != null) {
    const fromLot = lotPrice.get(materialLotId)
    if (fromLot != null && fromLot >= 0) return fromLot
  }
  if (materialProductId != null) {
    const fromProduct = productPrice.get(materialProductId)
    if (fromProduct != null && fromProduct >= 0) return fromProduct
  }
  return 0
}

export async function computeDailyProductionPl(dateYmd: string): Promise<DailyPlResult> {
  const { start, end, workDateGte, workDateLt } = kstDayBounds(dateYmd)
  const warnings: DailyPlWarning[] = []

  const [processRows, workEntries, materialUsages, backflushTxs] = await Promise.all([
    prisma.processResult.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: {
        productionLotId: true,
        processSequence: true,
        workerId: true,
        inputQty: true,
        goodQty: true,
        defectQty: true,
        createdAt: true,
        lot: { select: { productId: true } },
      },
    }),
    prisma.workerProcessWorkTimeEntry.findMany({
      where: { workDate: { gte: workDateGte, lt: workDateLt } },
      select: {
        workMinutes: true,
        process: { select: { productId: true } },
      },
    }),
    prisma.lotMaterialUsage.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: {
        usedQty: true,
        materialLotId: true,
        materialProductId: true,
        productionLot: { select: { productId: true } },
      },
    }),
    prisma.inventoryTransaction.findMany({
      where: {
        transactionType: 'OUT',
        refType: 'LOT',
        createdAt: { gte: start, lt: end },
      },
      select: {
        productId: true,
        qty: true,
        unitPrice: true,
        refId: true,
      },
    }),
  ])

  const qtyByProduct = new Map<number, { inputQty: number; goodQty: number; defectQty: number }>()
  for (const r of dedupeProcessResultsByProductionLot(processRows)) {
    const pid = r.lot.productId
    const cur = qtyByProduct.get(pid) ?? { inputQty: 0, goodQty: 0, defectQty: 0 }
    cur.inputQty += r.inputQty
    cur.goodQty += r.goodQty
    cur.defectQty += r.defectQty
    qtyByProduct.set(pid, cur)
  }

  const minutesByProduct = new Map<number, number>()
  for (const e of workEntries) {
    const pid = e.process.productId
    minutesByProduct.set(pid, (minutesByProduct.get(pid) ?? 0) + e.workMinutes)
  }

  const materialLotIds = [
    ...new Set(
      [
        ...materialUsages.map((u) => u.materialLotId).filter((id): id is number => id != null),
      ],
    ),
  ]
  const materialProductIds = [
    ...new Set(
      [
        ...materialUsages.map((u) => u.materialProductId).filter((id): id is number => id != null),
        ...backflushTxs.map((t) => t.productId),
      ],
    ),
  ]
  const { lotPrice, productPrice } = await buildMaterialUnitPriceCache(materialLotIds, materialProductIds)

  const usageCostByFg = new Map<number, number>()
  for (const u of materialUsages) {
    const fgId = u.productionLot.productId
    const qty = Number(u.usedQty.toString())
    const unit = resolveUsageUnitPrice(u.materialLotId, u.materialProductId, lotPrice, productPrice)
    usageCostByFg.set(fgId, (usageCostByFg.get(fgId) ?? 0) + qty * unit)
  }

  const prodLotIds = [...new Set(backflushTxs.map((t) => t.refId).filter((id): id is number => id != null))]
  const prodLots =
    prodLotIds.length > 0
      ? await prisma.productionLot.findMany({
          where: { id: { in: prodLotIds } },
          select: { id: true, productId: true },
        })
      : []
  const fgByProdLot = new Map(prodLots.map((l) => [l.id, l.productId]))

  const backflushCostByFg = new Map<number, number>()
  for (const tx of backflushTxs) {
    if (tx.refId == null) continue
    const fgId = fgByProdLot.get(tx.refId)
    if (fgId == null) continue
    const unit = dec(tx.unitPrice) ?? productPrice.get(tx.productId) ?? 0
    backflushCostByFg.set(fgId, (backflushCostByFg.get(fgId) ?? 0) + tx.qty * unit)
  }

  const productIds = [
    ...new Set([
      ...qtyByProduct.keys(),
      ...minutesByProduct.keys(),
      ...usageCostByFg.keys(),
      ...backflushCostByFg.keys(),
    ]),
  ]

  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            productCode: true,
            productName: true,
            itemType: true,
            unit: true,
          },
          orderBy: [{ itemType: 'asc' }, { productCode: 'asc' }],
        })
      : []

  const basisMap = await loadEffectiveBasisMap(productIds)
  const rollupEntries = await Promise.all(
    productIds.map(async (id) => [id, await rollupMaterialUnitCost(id).catch(() => 0)] as const),
  )
  const rollupMap = new Map(rollupEntries)

  const globalBasis = await getGlobalCostBasis()
  const global = serializeCostBasis(globalBasis)
  if (global.laborRatePerSec == null) {
    warnings.push({
      code: 'NO_GLOBAL_LABOR_RATE',
      message: '전사 초당 입률이 등록되지 않았습니다. 기준정보 > 생산 원가 기준에서 설정하세요.',
    })
  }
  if (global.fixedRatePerSec == null) {
    warnings.push({
      code: 'NO_GLOBAL_FIXED_RATE',
      message: '전사 고정입률이 등록되지 않았습니다. 기준정보 > 생산 원가 기준에서 설정하세요.',
    })
  }

  const rows: DailyPlProductRow[] = []
  const totals: DailyPlTotals = {
    goodQty: 0,
    workMinutes: 0,
    materialCost: 0,
    laborCost: 0,
    fixedCost: 0,
    productUnitCostTotal: 0,
    totalCost: 0,
    revenue: 0,
    profit: 0,
  }

  for (const p of products) {
    const qty = qtyByProduct.get(p.id) ?? { inputQty: 0, goodQty: 0, defectQty: 0 }
    const workMinutes = minutesByProduct.get(p.id) ?? 0
    const basis = basisMap.get(p.id)
    const rowWarnings: string[] = []
    const materialQtyBasis = qty.inputQty > 0 ? qty.inputQty : qty.goodQty
    const actualUsageCost = roundMoney(usageCostByFg.get(p.id) ?? 0)
    const backflushCost = roundMoney(backflushCostByFg.get(p.id) ?? 0)
    const standardPerUnit =
      basis?.materialUnitCost != null && basis.materialUnitCost > 0
        ? basis.materialUnitCost
        : rollupMap.get(p.id) ?? 0

    let materialCost = 0
    if (standardPerUnit > 0 && materialQtyBasis > 0) {
      materialCost = roundMoney(standardPerUnit * materialQtyBasis)
      if (actualUsageCost > 0 && Math.abs(actualUsageCost - materialCost) > 1) {
        rowWarnings.push(
          `실투입 자재비 ${actualUsageCost.toLocaleString('ko-KR')}원 · 표준(EBOM) ${materialCost.toLocaleString('ko-KR')}원`,
        )
      }
    } else if (actualUsageCost > 0) {
      materialCost = actualUsageCost
    } else if (backflushCost > 0) {
      materialCost = backflushCost
      rowWarnings.push('실투입 기록 없음 → 재고 OUT(백플러시) 기준')
    } else if (materialQtyBasis > 0) {
      rowWarnings.push('자재비 산정 불가 (EBOM·입고단가·투입기록 없음)')
    }

    const laborRate = basis?.laborRatePerSec ?? 0
    const fixedRate = basis?.fixedRatePerSec ?? 0
    const laborCost = roundMoney(workMinutes * 60 * laborRate)
    const fixedCost = roundMoney(workMinutes * 60 * fixedRate)
    const productUnitCostTotal = roundMoney(qty.goodQty * (basis?.productUnitCost ?? 0))
    if (qty.goodQty > 0 && basis?.productUnitCost == null) {
      rowWarnings.push('제품원가 미등록 (0원 처리)')
    }
    const totalCost = roundMoney(materialCost + laborCost + fixedCost + productUnitCostTotal)
    const revenue = roundMoney(qty.goodQty * (basis?.sellingPrice ?? 0))
    const profit = roundMoney(revenue - totalCost)

    if (qty.goodQty > 0 && basis?.sellingPrice == null) {
      rowWarnings.push('판매단가 미등록')
      warnings.push({
        code: 'NO_SELLING_PRICE',
        message: `${p.productCode} 판매단가가 없습니다.`,
        productId: p.id,
      })
    }
    if (qty.goodQty > 0 && workMinutes <= 0) {
      rowWarnings.push('생산시간 미입력')
      warnings.push({
        code: 'NO_WORK_TIME',
        message: `${p.productCode} 당일 작업시간이 없습니다.`,
        productId: p.id,
      })
    }

    rows.push({
      productId: p.id,
      productCode: p.productCode,
      productName: p.productName,
      itemType: p.itemType,
      unit: p.unit,
      goodQty: qty.goodQty,
      inputQty: qty.inputQty,
      defectQty: qty.defectQty,
      workMinutes,
      materialCost,
      laborCost,
      fixedCost,
      productUnitCostTotal,
      totalCost,
      revenue,
      profit,
      laborRatePerSec: laborRate > 0 ? laborRate : null,
      fixedRatePerSec: fixedRate > 0 ? fixedRate : null,
      sellingPriceUnit: basis?.sellingPrice ?? null,
      productUnitCostPerUnit: basis?.productUnitCost ?? null,
      materialStandardUnitCost: standardPerUnit > 0 ? standardPerUnit : null,
      materialQtyBasis,
      warnings: rowWarnings,
    })

    totals.goodQty += qty.goodQty
    totals.workMinutes += workMinutes
    totals.materialCost += materialCost
    totals.laborCost += laborCost
    totals.fixedCost += fixedCost
    totals.productUnitCostTotal += productUnitCostTotal
    totals.totalCost += totalCost
    totals.revenue += revenue
    totals.profit += profit
  }

  totals.materialCost = roundMoney(totals.materialCost)
  totals.laborCost = roundMoney(totals.laborCost)
  totals.fixedCost = roundMoney(totals.fixedCost)
  totals.productUnitCostTotal = roundMoney(totals.productUnitCostTotal)
  totals.totalCost = roundMoney(totals.totalCost)
  totals.revenue = roundMoney(totals.revenue)
  totals.profit = roundMoney(totals.profit)

  return { date: dateYmd, products: rows, totals, warnings }
}

export type DailyPlTrendDay = {
  date: string
  goodQty: number
  workMinutes: number
  profit: number
  profitPerUnit: number
  baselineOne: number
  extraProfit: number
}

function enumerateYmd(from: string, to: string): string[] {
  const start = from <= to ? from : to
  const end = from <= to ? to : from
  const days: string[] = []
  let cur = start
  while (cur <= end) {
    days.push(cur)
    cur = nextYmd(cur)
  }
  return days
}

/** KST 일자 구간별 일별 손익 추이 (1개 기준 대비 초과 이익 포함) */
export async function computeDailyProductionPlTrend(from: string, to: string): Promise<DailyPlTrendDay[]> {
  const dates = enumerateYmd(from, to)
  const results = await Promise.all(dates.map((d) => computeDailyProductionPl(d)))
  return results.map((r, i) => {
    const goodQty = r.totals.goodQty
    const profit = r.totals.profit
    const profitPerUnit = goodQty > 0 ? roundMoney(profit / goodQty) : 0
    const baselineOne = profitPerUnit
    const extraProfit = roundMoney(profit - baselineOne)
    return {
      date: dates[i],
      goodQty,
      workMinutes: r.totals.workMinutes,
      profit,
      profitPerUnit,
      baselineOne,
      extraProfit,
    }
  })
}
