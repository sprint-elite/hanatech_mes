import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './Layout'
import { AuditLogsPage } from '../pages/AuditLogsPage'
import { BarcodesPage } from '../pages/BarcodesPage'
import { CustomersPage } from '../pages/CustomersPage'
import { Dashboard } from '../pages/Dashboard'
import { DefectTypesPage } from '../pages/DefectTypesPage'
import { DefectHistoryPage } from '../pages/DefectHistoryPage'
import { EbomPage } from '../pages/EbomPage'
import { InventoryPage } from '../pages/InventoryPage'
import { IntegratedOpsPage } from '../pages/IntegratedOpsPage'
import { LocationsPage } from '../pages/LocationsPage'
import { LotHistoryPage } from '../pages/LotHistoryPage'
import { LotMaterialUsagePage } from '../pages/LotMaterialUsagePage'
import { LotsPage } from '../pages/LotsPage'
import { MaterialLotsPage } from '../pages/MaterialLotsPage'
import { MbomMaterialsPage } from '../pages/MbomMaterialsPage'
import { MbomPage } from '../pages/MbomPage'
import { NoticesPage } from '../pages/NoticesPage'
import { OutsourcingPage } from '../pages/OutsourcingPage'
import { ProcessHistoryPage } from '../pages/ProcessHistoryPage'
import { ProcessResultPage } from '../pages/ProcessResultPage'
import { ProcessRoutingPage } from '../pages/ProcessRoutingPage'
import { ProductionPlansPage } from '../pages/ProductionPlansPage'
import { ProductsPage } from '../pages/ProductsPage'
import { RolesPage } from '../pages/RolesPage'
import { ShipmentsPage } from '../pages/ShipmentsPage'
import { StockMovementsPage } from '../pages/StockMovementsPage'
import { SystemLogsPage } from '../pages/SystemLogsPage'
import { UsersPage } from '../pages/UsersPage'
import { VisionLogsPage } from '../pages/VisionLogsPage'
import { WorkCentersPage } from '../pages/WorkCentersPage'
import { WorkersPage } from '../pages/WorkersPage'
import { WorkOrdersPage } from '../pages/WorkOrdersPage'
import { FloorBoardPage } from '../pages/FloorBoardPage'
import { WorkerInputPage } from '../pages/WorkerInputPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="floor-board" element={<FloorBoardPage />} />
        <Route path="worker-input" element={<WorkerInputPage />} />
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="ebom" element={<EbomPage />} />
          <Route path="work-centers" element={<WorkCentersPage />} />
          <Route path="workers" element={<WorkersPage />} />
          <Route path="defect-types" element={<DefectTypesPage />} />
          <Route path="defect-history" element={<DefectHistoryPage />} />
          <Route path="mbom" element={<MbomPage />} />
          <Route path="mbom-materials" element={<MbomMaterialsPage />} />
          <Route path="locations" element={<LocationsPage />} />
          <Route path="production-plans" element={<ProductionPlansPage />} />
          <Route path="work-orders" element={<WorkOrdersPage />} />
          <Route path="lots" element={<LotsPage />} />
          <Route path="material-lots" element={<MaterialLotsPage />} />
          <Route path="process-routing" element={<ProcessRoutingPage />} />
          <Route path="lot-history" element={<LotHistoryPage />} />
          <Route path="lot-material-usage" element={<LotMaterialUsagePage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="stock-movements" element={<StockMovementsPage />} />
          <Route path="integrated-ops" element={<IntegratedOpsPage />} />
          <Route path="shipments" element={<ShipmentsPage />} />
          <Route path="outsourcing" element={<OutsourcingPage />} />
          <Route path="barcodes" element={<BarcodesPage />} />
          <Route path="process-result" element={<ProcessResultPage />} />
          <Route path="process-history" element={<ProcessHistoryPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="notices" element={<NoticesPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="system-logs" element={<SystemLogsPage />} />
          <Route path="vision-logs" element={<VisionLogsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
