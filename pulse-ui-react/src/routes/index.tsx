import { createBrowserRouter, Navigate, useLocation } from "react-router-dom"
import type { ReactElement } from "react"

import AppLayout from "@/layouts/AppLayout"
import AuthLayout from "@/layouts/AuthLayout"
import LoginPage from "@/auth/basic/LoginPage"
import RequestPasswordResetPage from "@/auth/basic/RequestPasswordResetPage"
import NotFound from "@/pages/NotFound"
import ErrorPage from "@/pages/ErrorPage"
import Error404 from "@/pages/error/Error404"
import Error500 from "@/pages/error/Error500"
import ComingSoon from "@/pages/error/ComingSoon"
import UserProfile from "@/pages/account/UserProfile"
import PasswordResetRequestsPage from "@/pages/account/PasswordResetRequestsPage"
import ClientsPage from "@/pages/axones/ClientsPage"
import ProductsPage from "@/pages/axones/ProductsPage"
import SuppliersPage from "@/pages/axones/SuppliersPage"
import PurchaseOrdersPage from "@/pages/axones/PurchaseOrdersPage"
import ClientOrdersPage from "@/pages/axones/ClientOrdersPage"
import ClientOrderNewPage from "@/pages/axones/ClientOrderNewPage"
import ClientOrderDetailPage from "@/pages/axones/ClientOrderDetailPage"
import ClientOrderEditPage from "@/pages/axones/ClientOrderEditPage"
import InventoryMovementsPage from "@/pages/axones/InventoryMovementsPage"
import InventoryMovementsPreviewPage from "@/pages/axones/InventoryMovementsPreviewPage"
import MaterialsPage from "@/pages/axones/MaterialsPage"
import MaterialFormPage from "@/pages/axones/MaterialFormPage"
import MaterialRequestsPage from "@/pages/axones/MaterialRequestsPage"
import PurchaseReceiptsPage from "@/pages/axones/PurchaseReceiptsPage"
import MiscellaneousReceiptsPage from "@/pages/axones/MiscellaneousReceiptsPage"
import BobinasPage from "@/pages/axones/BobinasPage"
import BobinaRejectedRegisterPage from "@/pages/axones/BobinaRejectedRegisterPage"
import InventoryReturnsPage from "@/pages/axones/InventoryReturnsPage"
import ProgramacionBoardPage from "@/pages/axones/ProgramacionBoardPage"
import WorkOrdersHubPage from "@/pages/axones/WorkOrdersHubPage"
import WorkOrderDetailPage from "@/pages/axones/WorkOrderDetailPage"
import WorkOrderPlanillaPage from "@/pages/axones/WorkOrderPlanillaPage"
import WorkOrderProductionPreviewPage from "@/pages/axones/WorkOrderProductionPreviewPage"
import CorteDispatchPage from "@/pages/axones/CorteDispatchPage"
import DeliveryNotesPage from "@/pages/axones/DeliveryNotesPage"
import PrefillNotaEntregaPage from "@/pages/axones/PrefillNotaEntregaPage"
import AreaRequestsPage from "@/pages/axones/AreaRequestsPage"
import GateMovementsPage from "@/pages/axones/GateMovementsPage"
import AxonesDashboardPage from "@/pages/axones/AxonesDashboardPage"
import AxonesOperationalAlertsPage from "@/pages/axones/AxonesOperationalAlertsPage"
import AxonesReportsPage from "@/pages/axones/AxonesReportsPage"
import TintaMixturesPage from "@/pages/axones/TintaMixturesPage"
import QualityWorkOrderPage from "@/pages/axones/QualityWorkOrderPage"
import QualityCertificatePreviewPage from "@/pages/axones/QualityCertificatePreviewPage"
import InventoryAreaPreviewPage from "@/pages/axones/InventoryAreaPreviewPage"
import ClientFormPage from "@/pages/axones/ClientFormPage"
import ProductFormPage from "@/pages/axones/ProductFormPage"
import SupplierFormPage from "@/pages/axones/SupplierFormPage"
import PurchaseOrderNewPage from "@/pages/axones/PurchaseOrderNewPage"
import PurchaseReceiptNewPage from "@/pages/axones/PurchaseReceiptNewPage"
import PurchaseReceiptPreviewPage from "@/pages/axones/PurchaseReceiptPreviewPage"
import MiscellaneousReceiptNewPage from "@/pages/axones/MiscellaneousReceiptNewPage"
import GateMovementNewPage from "@/pages/axones/GateMovementNewPage"
import MaterialRequestDetailPage from "@/pages/axones/MaterialRequestDetailPage"
import DeliveryNoteCreatePage from "@/pages/axones/DeliveryNoteCreatePage"
import AxonesChatPage from "@/pages/axones/AxonesChatPage"
import AreaPrintingPage from "@/pages/axones/AreaPrintingPage"
import AreaLaminacionPage from "@/pages/axones/AreaLaminacionPage"
import AreaCortePage from "@/pages/axones/AreaCortePage"
import AreaTintasPage from "@/pages/axones/AreaTintasPage"
import { getStoredUser } from "@/lib/auth-storage"
import { isAxonesUrlAllowed } from "@/lib/axones-roles"

function guardAxonesRoute({
  routeKey,
  element,
}: {
  routeKey: string
  element: ReactElement
}): ReactElement {
  const user = getStoredUser()
  const allowed = isAxonesUrlAllowed(routeKey, user?.role, user?.id)
  if (!allowed) return <Navigate to="/resumen" replace />
  return element
}

function LegacyInventoryAreasRedirect(): ReactElement {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const area = params.get("area")
  const date = params.get("date")
  const target = new URLSearchParams()
  if (area) target.set("area", area)
  if (date) target.set("date", date)

  return <Navigate to={`/materiales${target.toString() ? `?${target.toString()}` : ""}`} replace />
}

export const router = createBrowserRouter(
  [
    // AUTH ROUTES
    {
      element: <AuthLayout />,
      errorElement: <ErrorPage />,
      children: [
        { path: "auth/basic/login", element: <LoginPage /> },
        { path: "auth/basic/request-reset", element: <RequestPasswordResetPage /> },
        { path: "error/error-404", element: <Error404 /> },
        { path: "error/error-500", element: <Error500 /> },
        { path: "error/coming-soon", element: <ComingSoon /> },
      ],
    },

    // APP ROUTES
    {
      element: <AppLayout />,
      errorElement: <ErrorPage />,
      children: [
        { index: true, element: <AxonesDashboardPage /> },
        { path: "resumen", element: guardAxonesRoute({ routeKey: "resumen", element: <AxonesDashboardPage /> }) },
        { path: "alertas", element: guardAxonesRoute({ routeKey: "alertas", element: <AxonesOperationalAlertsPage /> }) },
        { path: "clientes", element: guardAxonesRoute({ routeKey: "clientes", element: <ClientsPage /> }) },
        { path: "clientes/form", element: guardAxonesRoute({ routeKey: "clientes", element: <ClientFormPage /> }) },
        { path: "productos", element: guardAxonesRoute({ routeKey: "productos", element: <ProductsPage /> }) },
        { path: "productos/form", element: guardAxonesRoute({ routeKey: "productos", element: <ProductFormPage /> }) },
        { path: "proveedores", element: guardAxonesRoute({ routeKey: "proveedores", element: <SuppliersPage /> }) },
        { path: "proveedores/form", element: guardAxonesRoute({ routeKey: "proveedores", element: <SupplierFormPage /> }) },
        { path: "ordenes-compra", element: guardAxonesRoute({ routeKey: "ordenes-compra", element: <PurchaseOrdersPage /> }) },
        { path: "ordenes-compra/nueva", element: guardAxonesRoute({ routeKey: "ordenes-compra/nueva", element: <PurchaseOrderNewPage /> }) },
        { path: "ordenes-cliente", element: guardAxonesRoute({ routeKey: "ordenes-cliente", element: <ClientOrdersPage /> }) },
        { path: "ordenes-cliente/nueva", element: guardAxonesRoute({ routeKey: "ordenes-cliente/nueva", element: <ClientOrderNewPage /> }) },
        { path: "ordenes-cliente/:coId/edit", element: guardAxonesRoute({ routeKey: "ordenes-cliente", element: <ClientOrderEditPage /> }) },
        { path: "ordenes-cliente/:coId", element: guardAxonesRoute({ routeKey: "ordenes-cliente", element: <ClientOrderDetailPage /> }) },
        { path: "pedidos-cliente", element: guardAxonesRoute({ routeKey: "pedidos-cliente", element: <ClientOrdersPage /> }) },
        { path: "materiales", element: guardAxonesRoute({ routeKey: "materiales", element: <MaterialsPage /> }) },
        { path: "materiales/nuevo", element: guardAxonesRoute({ routeKey: "materiales", element: <MaterialFormPage /> }) },
        { path: "materiales/:id/editar", element: guardAxonesRoute({ routeKey: "materiales", element: <MaterialFormPage /> }) },
        {
          path: "inventario-areas",
          element: guardAxonesRoute({ routeKey: "inventario-areas", element: <LegacyInventoryAreasRedirect /> }),
        },
        {
          path: "inventario-areas/vista-previa",
          element: guardAxonesRoute({ routeKey: "inventario-areas", element: <InventoryAreaPreviewPage /> }),
        },
        {
          path: "movimientos-inventario",
          element: guardAxonesRoute({ routeKey: "movimientos-inventario", element: <InventoryMovementsPage /> }),
        },
        {
          path: "movimientos-inventario/vista-previa",
          element: guardAxonesRoute({ routeKey: "movimientos-inventario", element: <InventoryMovementsPreviewPage /> }),
        },
        { path: "recepciones-oc", element: guardAxonesRoute({ routeKey: "recepciones-oc", element: <PurchaseReceiptsPage /> }) },
        {
          path: "recepciones-oc/:id/vista-previa",
          element: guardAxonesRoute({ routeKey: "recepciones-oc", element: <PurchaseReceiptPreviewPage /> }),
        },
        { path: "recepciones-nueva", element: guardAxonesRoute({ routeKey: "recepciones-nueva", element: <PurchaseReceiptNewPage /> }) },
        {
          path: "miscelaneos",
          element: guardAxonesRoute({ routeKey: "miscelaneos", element: <MiscellaneousReceiptsPage /> }),
        },
        { path: "miscelaneos/nuevo", element: guardAxonesRoute({ routeKey: "miscelaneos/nuevo", element: <MiscellaneousReceiptNewPage /> }) },
        { path: "bobinas", element: guardAxonesRoute({ routeKey: "bobinas", element: <BobinasPage /> }) },
        {
          path: "bobinas/registrar-rechazada",
          element: guardAxonesRoute({ routeKey: "bobinas/registrar-rechazada", element: <BobinaRejectedRegisterPage /> }),
        },
        { path: "devoluciones", element: guardAxonesRoute({ routeKey: "devoluciones", element: <InventoryReturnsPage /> }) },
        {
          path: "solicitudes-material",
          element: guardAxonesRoute({ routeKey: "solicitudes-material", element: <MaterialRequestsPage /> }),
        },
        {
          path: "solicitudes-material/:id",
          element: guardAxonesRoute({ routeKey: "solicitudes-material", element: <MaterialRequestDetailPage /> }),
        },
        { path: "programacion", element: guardAxonesRoute({ routeKey: "programacion", element: <ProgramacionBoardPage /> }) },
        { path: "impresion", element: guardAxonesRoute({ routeKey: "impresion", element: <AreaPrintingPage /> }) },
        { path: "laminacion", element: guardAxonesRoute({ routeKey: "laminacion", element: <AreaLaminacionPage /> }) },
        { path: "corte", element: guardAxonesRoute({ routeKey: "corte", element: <AreaCortePage /> }) },
        { path: "tintas", element: guardAxonesRoute({ routeKey: "tintas", element: <AreaTintasPage /> }) },
        { path: "ordenes-trabajo", element: guardAxonesRoute({ routeKey: "ordenes-trabajo", element: <WorkOrdersHubPage /> }) },
        {
          path: "ordenes-trabajo/nueva",
          element: guardAxonesRoute({ routeKey: "ordenes-trabajo", element: <Navigate to="/ordenes-trabajo" replace /> }),
        },
        {
          path: "ordenes-trabajo/:woId/vista-previa",
          element: guardAxonesRoute({
            routeKey: "ordenes-trabajo",
            element: <WorkOrderProductionPreviewPage />,
          }),
        },
        {
          path: "ordenes-trabajo/:woId",
          element: guardAxonesRoute({ routeKey: "ordenes-trabajo", element: <WorkOrderPlanillaPage /> }),
        },
        {
          path: "ordenes-trabajo/:woId/produccion",
          element: guardAxonesRoute({
            routeKey: "ordenes-trabajo-produccion",
            element: <WorkOrderDetailPage />,
          }),
        },
        { path: "prefill-nota-entrega", element: guardAxonesRoute({ routeKey: "prefill-nota-entrega", element: <PrefillNotaEntregaPage /> }) },
        { path: "nota-entrega-nueva", element: guardAxonesRoute({ routeKey: "nota-entrega-nueva", element: <DeliveryNoteCreatePage /> }) },
        { path: "despacho-corte", element: guardAxonesRoute({ routeKey: "despacho-corte", element: <CorteDispatchPage /> }) },
        { path: "notas-entrega", element: guardAxonesRoute({ routeKey: "notas-entrega", element: <DeliveryNotesPage /> }) },
        { path: "calidad", element: guardAxonesRoute({ routeKey: "calidad", element: <QualityWorkOrderPage /> }) },
        { path: "calidad/vista-previa", element: guardAxonesRoute({ routeKey: "calidad", element: <QualityCertificatePreviewPage /> }) },
        { path: "solicitudes-area", element: guardAxonesRoute({ routeKey: "solicitudes-area", element: <AreaRequestsPage /> }) },
        { path: "vigilancia", element: guardAxonesRoute({ routeKey: "vigilancia", element: <GateMovementsPage /> }) },
        { path: "vigilancia/nuevo", element: guardAxonesRoute({ routeKey: "vigilancia/nuevo", element: <GateMovementNewPage /> }) },
        { path: "reportes", element: guardAxonesRoute({ routeKey: "reportes", element: <AxonesReportsPage /> }) },
        { path: "asistente", element: guardAxonesRoute({ routeKey: "asistente", element: <AxonesChatPage /> }) },
        { path: "mezclas-tinta", element: guardAxonesRoute({ routeKey: "mezclas-tinta", element: <TintaMixturesPage /> }) },

        // account
        { path: "account/profile", element: <UserProfile /> },
        {
          path: "account/password-reset-requests",
          element: guardAxonesRoute({
            routeKey: "account/password-reset-requests",
            element: <PasswordResetRequestsPage />,
          }),
        },

        // 404 HANDLER
        { path: "*", element: <NotFound /> },
      ],
    },
  ],
  {
    basename: "/axones",
  }
)
