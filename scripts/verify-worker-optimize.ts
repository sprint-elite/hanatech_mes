/**
 * 자동 배정 최적해 검증: 저장 데이터 기준 전 조합 탐색
 */
import { prisma } from '../src/server/db/prisma'
import { effectiveGoodQtyForProcess } from '../src/server/lib/workerContribution'
import {
  flowLineMakespanSeconds,
  optimizeProcessWorkerAssignmentGrouped,
} from '../src/server/lib/processWorkerOptimize'
import { groupWorkerCountBounds } from '../src/server/lib/processWorkerLimits'

const productId = 4
const orderQty = 500
const processGroups = [[1, 2], [3], [4, 5]]

async function main() {
  const [processes, workers, results, processWorkTimes, workTimeEntries] = await Promise.all([
    prisma.mbomProcess.findMany({
      where: { productId, useYn: 'Y' },
      orderBy: [{ sequence: 'asc' }],
    }),
    prisma.worker.findMany({ where: { status: 'ACTIVE' }, orderBy: { workerCode: 'asc' } }),
    prisma.processResult.findMany({
      where: { workerId: { not: null }, lot: { productId } },
      select: { workerId: true, processId: true, inputQty: true, goodQty: true },
    }),
    prisma.workerProcessWorkTime.findMany({
      where: { process: { productId } },
      select: { workerId: true, processId: true, workMinutes: true },
    }),
    prisma.workerProcessWorkTimeEntry.findMany({
      where: { process: { productId } },
      select: {
        workerId: true,
        processId: true,
        goodQty: true,
        inputQty: true,
        workMinutes: true,
        contributionPct: true,
      },
    }),
  ])

  const processAgg = new Map<string, { goodQty: number; inputQty: number }>()
  for (const r of results) {
    if (r.workerId == null) continue
    const k = `${r.workerId}:${r.processId}`
    const cur = processAgg.get(k) ?? { goodQty: 0, inputQty: 0 }
    cur.goodQty += r.goodQty
    cur.inputQty += r.inputQty
    processAgg.set(k, cur)
  }

  const entriesByWP = new Map<string, typeof workTimeEntries>()
  for (const e of workTimeEntries) {
    const k = `${e.workerId}:${e.processId}`
    const list = entriesByWP.get(k) ?? []
    list.push(e)
    entriesByWP.set(k, list)
  }

  const workMinMap = new Map(processWorkTimes.map((w) => [`${w.workerId}:${w.processId}`, w.workMinutes]))
  const historySec = new Map<string, number>()
  const minGoodQty = 1

  console.log('=== 작업자×공정 단위시간(초) — 실적 우선, 없으면 표준 ===\n')
  const standardSecByProcess = new Map<number, number | null>()
  const workerLimitsByProcess = new Map<number, { minWorkers: number; maxWorkers: number }>()
  for (const p of processes) {
    standardSecByProcess.set(
      p.id,
      p.standardTime != null && p.baseQty != null && p.baseQty > 0
        ? Number(p.standardTime) / p.baseQty
        : null,
    )
    workerLimitsByProcess.set(p.id, { minWorkers: p.minWorkers, maxWorkers: p.maxWorkers })
    console.log(`${p.processCode} ${p.processName} | 표준 ${standardSecByProcess.get(p.id)}초/개 | 인원 ${p.minWorkers}~${p.maxWorkers}`)
  }
  console.log('')

  for (const w of workers) {
    const row: string[] = []
    for (const p of processes) {
      const k = `${w.id}:${p.id}`
      const a = processAgg.get(k) ?? { goodQty: 0, inputQty: 0 }
      const wm = workMinMap.get(k) ?? 0
      const entryList = entriesByWP.get(k) ?? []
      const qtyBasis = effectiveGoodQtyForProcess(a.goodQty, a.inputQty, entryList)
      let sec: number | null = null
      let src = '—'
      if (wm > 0 && qtyBasis >= minGoodQty) {
        sec = Math.round(((wm * 60) / qtyBasis) * 10000) / 10000
        historySec.set(k, sec)
        src = '실적'
      } else {
        const std = standardSecByProcess.get(p.id)
        if (std != null) {
          sec = std
          src = '표준'
        }
      }
      row.push(`${p.processCode}:${sec != null ? sec.toFixed(2) : '—'}(${src})`)
    }
    console.log(`${w.workerCode} ${w.workerName} | ${row.join(' | ')}`)
  }

  console.log('\n=== 묶음별 제약 ===')
  for (const g of processGroups) {
    const b = groupWorkerCountBounds(g, workerLimitsByProcess)
    const codes = g.map((id) => processes.find((p) => p.id === id)?.processCode).join('+')
    console.log(`${codes}: 인원 ${JSON.stringify(b)}`)
  }

  const outcome = optimizeProcessWorkerAssignmentGrouped(
    processGroups,
    workers.map((w) => ({ id: w.id })),
    historySec,
    standardSecByProcess,
    workerLimitsByProcess,
    orderQty,
  )

  if ('error' in outcome) {
    console.log('optimize error', outcome)
    return
  }

  console.log('\n=== 최적해 (엔진) ===')
  console.log(`완료 예상: ${outcome.estimatedMakespanSeconds}초 (약 ${Math.round(outcome.estimatedMakespanSeconds / 60)}분)`)
  console.log(`사용 작업자: ${outcome.totalWorkersUsed}명`)

  const groupLabels = ['1+2', '3', '4+5']
  let gi = 0
  for (const g of processGroups) {
    const wids = new Set(
      outcome.assignments.filter((a) => g.includes(a.processId)).map((a) => a.workerId),
    )
    const names = [...wids].map((id) => workers.find((w) => w.id === id)?.workerCode)
    const ranked = workers
      .map((w) => {
        let sum = 0
        for (const pid of g) {
          const hist = historySec.get(`${w.id}:${pid}`)
          const std = standardSecByProcess.get(pid)
          sum += hist ?? std ?? Infinity
        }
        return { code: w.workerCode, sum }
      })
      .filter((x) => Number.isFinite(x.sum))
      .sort((a, b) => a.sum - b.sum)
    const bounds = groupWorkerCountBounds(g, workerLimitsByProcess) as { lo: number; hi: number }
    console.log(`\n묶음 ${groupLabels[gi]} 배정: ${names.join(', ')} (lo~hi ${bounds.lo}~${bounds.hi})`)
    console.log('  후보 합산시간 순위:', ranked.map((r) => `${r.code}=${r.sum.toFixed(2)}s`).join(', '))
    gi++
  }

  // 스크린샷 배정 검증
  const screenshot = {
    '1+2': [4, 5], // 최알바, 정알바
    '3': [2], // 이알바
    '4+5': [3, 1], // 박알바, 김알바
  }
  console.log('\n=== 스크린샷 배정 vs 최적해 ===')
  const stageSecs: number[] = []
  let idx = 0
  for (const g of processGroups) {
    const key = groupLabels[idx]!
    const wids = screenshot[key as keyof typeof screenshot]
    const ranked = wids
      .map((wid) => {
        let sum = 0
        for (const pid of g) {
          const hist = historySec.get(`${wid}:${pid}`)
          const std = standardSecByProcess.get(pid)
          sum += hist ?? std ?? Infinity
        }
        return sum
      })
      .sort((a, b) => a - b)
    const bestSec = ranked[0]!
    const k = wids.length
    const stage = bestSec / k
    stageSecs.push(stage)
    const codes = wids.map((id) => workers.find((w) => w.id === id)?.workerCode)
    console.log(`묶음 ${key}: ${codes.join('+')} | stage ${stage.toFixed(4)}초/유닛 (best ${bestSec.toFixed(2)}/k=${k})`)
    idx++
  }
  const screenshotMakespan = flowLineMakespanSeconds(stageSecs, orderQty)
  console.log(`스크린샷 배정 makespan: ${screenshotMakespan.toFixed(2)}초 (약 ${Math.round(screenshotMakespan / 60)}분)`)
  console.log(
    `최적해 대비: ${screenshotMakespan === outcome.estimatedMakespanSeconds ? '동일 ✓' : `차이 ${(screenshotMakespan - outcome.estimatedMakespanSeconds).toFixed(2)}초`}`,
  )

  // 묶음4+5에서 김알바 vs 박알바만 2명일 때 다른 조합 비교
  console.log('\n=== 묶음 4+5 주요 2인 조합 비교 (stage 시간) ===')
  const g45 = [4, 5]
  const pairs: [number, number][] = []
  for (let i = 0; i < workers.length; i++) {
    for (let j = i + 1; j < workers.length; j++) {
      pairs.push([workers[i]!.id, workers[j]!.id])
    }
  }
  const pairResults = pairs
    .map(([a, b]) => {
      const ta = g45.reduce((s, pid) => s + (historySec.get(`${a}:${pid}`) ?? standardSecByProcess.get(pid) ?? 999), 0)
      const tb = g45.reduce((s, pid) => s + (historySec.get(`${b}:${pid}`) ?? standardSecByProcess.get(pid) ?? 999), 0)
      const best = Math.min(ta, tb)
      const stage = best / 2
      return {
        pair: `${workers.find((w) => w.id === a)?.workerCode}+${workers.find((w) => w.id === b)?.workerCode}`,
        ta,
        tb,
        stage,
      }
    })
    .sort((x, y) => x.stage - y.stage)
  for (const r of pairResults.slice(0, 6)) {
    console.log(
      `  ${r.pair}: A합=${r.ta.toFixed(2)}s B합=${r.tb.toFixed(2)}s → stage=${r.stage.toFixed(4)}s`,
    )
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
