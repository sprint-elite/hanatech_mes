import express from 'express'
import { defectTypesRouter } from './routes/defectTypes'
import { inventoryRouter } from './routes/inventoryItems'
import { mbomProcessesRouter } from './routes/mbomProcesses'
import { processResultsRouter } from './routes/processResults'
import { extendedMastersRouter } from './routes/extendedMasters'
import { extendedOpsRouter } from './routes/extendedOps'
import { mesTransactionsRouter } from './routes/mesTransactions'
import { productsRouter } from './routes/products'
import { productionLotsRouter } from './routes/productionLots'
import { workCentersRouter } from './routes/workCenters'
import { workersRouter } from './routes/workers'
import { customersRouter } from './routes/customers'
import { authRouter } from './routes/auth'
import { annualLeaveRouter } from './routes/annualLeave'
import { erpSchedulesRouter } from './routes/erpSchedules'
import { payStubsRouter } from './routes/payStubs'
import { smartFactoryLogRouter } from './routes/smartFactoryLog'
import { smartFactoryLogMiddleware } from './middleware/smartFactoryLog'
import { startSmartFactoryLogFlusher } from './lib/smartFactoryLog/sender'

const app = express()
app.set('trust proxy', 1)
app.use(express.json())
app.use(smartFactoryLogMiddleware)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

app.use('/api', productsRouter)
app.use('/api', customersRouter)
app.use('/api', authRouter)
app.use('/api', annualLeaveRouter)
app.use('/api', erpSchedulesRouter)
app.use('/api', payStubsRouter)
app.use('/api', smartFactoryLogRouter)
app.use('/api', workCentersRouter)
app.use('/api', workersRouter)
app.use('/api', defectTypesRouter)
app.use('/api', mbomProcessesRouter)
app.use('/api', productionLotsRouter)
app.use('/api', inventoryRouter)
app.use('/api', processResultsRouter)
app.use('/api', extendedMastersRouter)
app.use('/api', extendedOpsRouter)
app.use('/api', mesTransactionsRouter)

const port = Number(process.env.PORT ?? 4000)
startSmartFactoryLogFlusher()
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`)
})
