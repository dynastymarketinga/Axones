import { createBrowserRouter, Navigate } from "react-router-dom"

import AppLayout from "@/layouts/AppLayout"
import AuthLayout from "@/layouts/AuthLayout"

import AnalyticsDashboard from "@/pages/dashboard/analytics/AnalyticsDashboard"
import EcommerceDashboard from "@/pages/dashboard/eCommerce/EcommerceDashboard"
import CrmDashboard from "@/pages/dashboard/crm/CrmDashboard"

import ChartsPage from "@/pages/charts/recharts/ReChartsPage"

import DataWidgetsPage from "@/pages/widgets/data/DataWidgetsPage"
import StatisticsWidgetsPage from "@/pages/widgets/statistics/StatisticsWidgetsPage"

import LoginPage from "@/auth/basic/LoginPage"
import RegisterPage from "@/auth/basic/RegisterPage"
import ForgotPasswordPage from "@/auth/basic/ForgotPasswordPage"

import NotFound from "@/pages/NotFound"
import ErrorPage from "@/pages/ErrorPage"
import Documentation from "@/pages/Documentation"
import { ResetPasswordForm } from "@/auth/basic/ResetPasswordForm"
import { VerifyEmailForm } from "@/auth/basic/VerifyEmailForm"
import { PasswordResetSuccess } from "@/auth/basic/PasswordResetSuccess"
import CoverLoginPage from "@/auth/cover/CoverLoginPage"
import CoverForgotPasswordPage from "@/auth/cover/CoverForgotPasswordPage"
import CoverRegisterPage from "@/auth/cover/CoverRegisterPage"
import CoverResetPasswordPage from "@/auth/cover/CoverResetPasswordPage"
import CoverVerifyEmailPage from "@/auth/cover/CoverVerifyEmailPage"
import CoverPasswordResetSuccessPage from "@/auth/cover/CoverPasswordResetSuccessPage"
import ProductList from "@/pages/eCommerce/ProductList"
import ProductGrid from "@/pages/eCommerce/ProductGrid"
import AddProduct from "@/pages/eCommerce/AddProduct"
import CategoryList from "@/pages/eCommerce/CategoryList"
import OrderList from "@/pages/eCommerce/OrderList"
import OrderDetails from "@/pages/eCommerce/OrderDetails"
import InvoicePage from "@/pages/eCommerce/Invoice"
import InvoiceCard from "@/pages/eCommerce/InvoiceCard"
import CustomerList from "@/pages/eCommerce/CustomerList"
import CustomerDetails from "@/pages/eCommerce/CustomerDetails"
import ChatBox from "@/pages/apps/Chatbox"
import CalendarPage from "@/pages/apps/CalendarPage"
import FileManagerPage from "@/pages/apps/FileManager"
import AlertsPage from "@/pages/alerts/AlertsPage"
import AccordionPage from "@/pages/accordion/AccordionPage"
import SoonerPage from "@/pages/sooner/SoonerPage"
import BadgesPage from "@/pages/badges/BadgesPage"
import ButtonsPage from "@/pages/buttons/ButtonsPage"
import CardsPage from "@/pages/cards/CardsPage"
import ListGroupPage from "@/pages/listgroups/ListGroupPage"
import CarouselPage from "@/pages/carousels/CarouselPage"
import AvatarShowcase from "@/pages/mediaobject/AvatarShowcase"
import NavbarsPage from "@/pages/navbars/NavbarsPage"
import ProgressPage from "@/pages/progressbars/ProgressPage"
import SpinnerExamples from "@/pages/spinners/SpinnerExamples"
import Boxicons from "@/pages/icons/Boxicons"
import IconBootstrap from "@/pages/icons/Bootstrap"
import LucideIconsPage from "@/pages/icons/LucideIconsPage"
import PricingPage from "@/pages/pricing/PricingPage"
import FAQPage from "@/pages/FAQPage"
import Error404 from "@/pages/error/Error404"
import Error500 from "@/pages/error/Error500"
import ComingSoon from "@/pages/error/ComingSoon"
import ReChartsPage from "@/pages/charts/recharts/ReChartsPage"
import ApexChartsPage from "@/pages/charts/apexcharts/ApexChartsPage"
import UserProfile from "@/pages/account/UserProfile"
import EditProfile from "@/pages/account/EditProfile"
import PasswordSettings from "@/pages/account/PasswordSettings"
import NotificationSettings from "@/pages/account/NotificationSettings"
import BasicTables from "@/pages/tables/BasicTables"
import AdvanceTablesPage from "@/pages/tables/advance-tables/AdvanceTable"
import DataTablePage from "@/pages/tables/DataTablePage"
import BasicInput from "@/pages/forms/BasicInputs"
import FormInputGroup from "@/pages/forms/FormInputGroup"
import ChecksAndRadios from "@/pages/forms/ChecksAndRadios"
import FormLayouts from "@/pages/forms/FormLayouts"
import WizardPage from "@/pages/forms/wizard/WizardPage"
import FormTextEditor from "@/pages/forms/FormTextEditor"
import FileUpload01 from "@/pages/forms/fileupload/FileUpload01"
import DatePickerPage from "@/pages/forms/datepicker/DatePickerPage"
import SelectExamplesPage from "@/pages/forms/select/SelectExamplesPage"
import FormRepeater from "@/pages/forms/FormRepeater"
import LandingPage from "@/pages/dashboard/analytics/LandingPage"
import ClientsPage from "@/pages/axones/ClientsPage"
import ProductsPage from "@/pages/axones/ProductsPage"
import SuppliersPage from "@/pages/axones/SuppliersPage"
import PurchaseOrdersPage from "@/pages/axones/PurchaseOrdersPage"
import ClientOrdersPage from "@/pages/axones/ClientOrdersPage"
import ClientOrderNewPage from "@/pages/axones/ClientOrderNewPage"
import ClientOrderDetailPage from "@/pages/axones/ClientOrderDetailPage"
import ClientOrderEditPage from "@/pages/axones/ClientOrderEditPage"
import InventoryMovementsPage from "@/pages/axones/InventoryMovementsPage"
import MaterialsPage from "@/pages/axones/MaterialsPage"
import MaterialRequestsPage from "@/pages/axones/MaterialRequestsPage"
import PurchaseReceiptsPage from "@/pages/axones/PurchaseReceiptsPage"
import MiscellaneousReceiptsPage from "@/pages/axones/MiscellaneousReceiptsPage"
import BobinasPage from "@/pages/axones/BobinasPage"
import InventoryReturnsPage from "@/pages/axones/InventoryReturnsPage"
import ProgramacionBoardPage from "@/pages/axones/ProgramacionBoardPage"
import WorkOrdersHubPage from "@/pages/axones/WorkOrdersHubPage"
import WorkOrderDetailPage from "@/pages/axones/WorkOrderDetailPage"
import WorkOrderPlanillaPage from "@/pages/axones/WorkOrderPlanillaPage"
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
import MaterialsInventoryHubPage from "@/pages/axones/MaterialsInventoryHubPage"
import ClientFormPage from "@/pages/axones/ClientFormPage"
import ProductFormPage from "@/pages/axones/ProductFormPage"
import SupplierFormPage from "@/pages/axones/SupplierFormPage"
import VendorsPage from "@/pages/axones/VendorsPage"
import VendorFormPage from "@/pages/axones/VendorFormPage"
import PurchaseOrderNewPage from "@/pages/axones/PurchaseOrderNewPage"
import PurchaseReceiptNewPage from "@/pages/axones/PurchaseReceiptNewPage"
import MiscellaneousReceiptNewPage from "@/pages/axones/MiscellaneousReceiptNewPage"
import GateMovementNewPage from "@/pages/axones/GateMovementNewPage"
import MaterialRequestDetailPage from "@/pages/axones/MaterialRequestDetailPage"
import DeliveryNoteCreatePage from "@/pages/axones/DeliveryNoteCreatePage"
import AxonesChatPage from "@/pages/axones/AxonesChatPage"
import AreaPrintingPage from "@/pages/axones/AreaPrintingPage"
import AreaLaminacionPage from "@/pages/axones/AreaLaminacionPage"
import AreaCortePage from "@/pages/axones/AreaCortePage"
import AreaTintasPage from "@/pages/axones/AreaTintasPage"

export const router = createBrowserRouter (
  [
    // 🔐 AUTH ROUTES
    {
      element: <AuthLayout />,
      errorElement: <ErrorPage />,
      children: [
        {path: "auth/basic/login", element: <LoginPage /> },
        {path: "auth/basic/register", element: <RegisterPage /> },
        {path: "auth/basic/forgot-password", element: <ForgotPasswordPage /> },
        {path: "auth/basic/reset-password", element: <ResetPasswordForm /> },
        {path: "auth/basic/verify-email", element: <VerifyEmailForm /> },
        {path: "auth/basic/password-reset-success", element: <PasswordResetSuccess /> },

        {path: "auth/cover/login", element: <CoverLoginPage /> },
        {path: "auth/cover/register", element: <CoverRegisterPage /> },
        {path: "auth/cover/forgot-password", element: <CoverForgotPasswordPage /> },
        {path: "auth/cover/new-password", element: <CoverResetPasswordPage /> },
        {path: "auth/cover/password-reset-success", element: <CoverPasswordResetSuccessPage /> },
        {path: "auth/cover/verify-email", element: <CoverVerifyEmailPage /> },

        {path: "error/error-404", element: <Error404 /> },
        {path: "error/error-500", element: <Error500 /> },
        {path: "error/coming-soon", element: <ComingSoon /> },

      ],
    },

    // 📊 APP ROUTES
    {
      element: <AppLayout />,
      errorElement: <ErrorPage />,
      children: [
        { index: true, element: <AxonesDashboardPage /> },
        {path: "dashboard/analytics", element: <AnalyticsDashboard /> },
        {path: "dashboard/crm", element: <CrmDashboard /> },
        {path: "dashboard/eCommerce", element: <EcommerceDashboard /> },
        {path: "dashboard/landing-page", element: <LandingPage /> },
        
        {path: "dashboard/charts", element: <ChartsPage /> },
        {path: "widgets/data", element: <DataWidgetsPage /> },
        {path: "widgets/statistics", element: <StatisticsWidgetsPage /> },
        {path: "docs", element: <Documentation /> },

        { path: "axones/resumen", element: <AxonesDashboardPage /> },
        { path: "axones/alertas", element: <AxonesOperationalAlertsPage /> },
        { path: "axones/clientes", element: <ClientsPage /> },
        { path: "axones/clientes/form", element: <ClientFormPage /> },
        { path: "axones/vendedores", element: <VendorsPage /> },
        { path: "axones/vendedores/form", element: <VendorFormPage /> },
        { path: "axones/productos", element: <ProductsPage /> },
        { path: "axones/productos/form", element: <ProductFormPage /> },
        { path: "axones/proveedores", element: <SuppliersPage /> },
        { path: "axones/proveedores/form", element: <SupplierFormPage /> },
        { path: "axones/ordenes-compra", element: <PurchaseOrdersPage /> },
        { path: "axones/ordenes-compra/nueva", element: <PurchaseOrderNewPage /> },
        { path: "axones/ordenes-cliente", element: <ClientOrdersPage /> },
        { path: "axones/ordenes-cliente/nueva", element: <ClientOrderNewPage /> },
        { path: "axones/ordenes-cliente/:coId/edit", element: <ClientOrderEditPage /> },
        { path: "axones/ordenes-cliente/:coId", element: <ClientOrderDetailPage /> },
        { path: "axones/pedidos-cliente", element: <ClientOrdersPage /> },
        { path: "axones/materiales", element: <MaterialsPage /> },
        { path: "axones/inventario-areas", element: <MaterialsInventoryHubPage /> },
        {
          path: "axones/movimientos-inventario",
          element: <InventoryMovementsPage />,
        },
        { path: "axones/recepciones-oc", element: <PurchaseReceiptsPage /> },
        { path: "axones/recepciones-nueva", element: <PurchaseReceiptNewPage /> },
        {
          path: "axones/miscelaneos",
          element: <MiscellaneousReceiptsPage />,
        },
        { path: "axones/miscelaneos/nuevo", element: <MiscellaneousReceiptNewPage /> },
        { path: "axones/bobinas", element: <BobinasPage /> },
        { path: "axones/devoluciones", element: <InventoryReturnsPage /> },
        {
          path: "axones/solicitudes-material",
          element: <MaterialRequestsPage />,
        },
        {
          path: "axones/solicitudes-material/:id",
          element: <MaterialRequestDetailPage />,
        },
        { path: "axones/programacion", element: <ProgramacionBoardPage /> },
        { path: "axones/impresion", element: <AreaPrintingPage /> },
        { path: "axones/laminacion", element: <AreaLaminacionPage /> },
        { path: "axones/corte", element: <AreaCortePage /> },
        { path: "axones/tintas", element: <AreaTintasPage /> },
        { path: "axones/ordenes-trabajo", element: <WorkOrdersHubPage /> },
        {
          path: "axones/ordenes-trabajo/nueva",
          element: <Navigate to="/axones/ordenes-trabajo" replace />,
        },
        {
          path: "axones/ordenes-trabajo/:woId",
          element: <WorkOrderPlanillaPage />,
        },
        {
          path: "axones/ordenes-trabajo/:woId/produccion",
          element: <WorkOrderDetailPage />,
        },
        { path: "axones/prefill-nota-entrega", element: <PrefillNotaEntregaPage /> },
        { path: "axones/nota-entrega-nueva", element: <DeliveryNoteCreatePage /> },
        { path: "axones/despacho-corte", element: <CorteDispatchPage /> },
        { path: "axones/notas-entrega", element: <DeliveryNotesPage /> },
        { path: "axones/calidad", element: <QualityWorkOrderPage /> },
        { path: "axones/solicitudes-area", element: <AreaRequestsPage /> },
        { path: "axones/vigilancia", element: <GateMovementsPage /> },
        { path: "axones/vigilancia/nuevo", element: <GateMovementNewPage /> },
        { path: "axones/reportes", element: <AxonesReportsPage /> },
        { path: "axones/asistente", element: <AxonesChatPage /> },
        { path: "axones/mezclas-tinta", element: <TintaMixturesPage /> },

        // 🛍️ E-COMMERCE
        {path: "eCommerce/product-list", element: <ProductList /> },
        {path: "eCommerce/product-grid", element: <ProductGrid /> },
        {path: "eCommerce/add-product", element: <AddProduct /> },
        {path: "eCommerce/categories", element: <CategoryList /> },
        {path: "eCommerce/order-list", element: <OrderList /> },
        {path: "eCommerce/order-details", element: <OrderDetails /> },
        {path: "eCommerce/customer-list", element: <CustomerList /> },
        {path: "eCommerce/customer-details", element: <CustomerDetails /> },
        {path: "eCommerce/invoice", element: <InvoicePage /> },

        // application routes
        {path: "app/chatbox", element: <ChatBox /> },
        {path: "app/invoice-card", element: <InvoiceCard/> },
        {path: "app/calendar", element: <CalendarPage /> },
        {path: "app/file-manager", element: <FileManagerPage /> },

        // component 
        {path: "components/alerts", element: <AlertsPage /> },
        {path: "components/accordion", element: <AccordionPage/>},
        {path: "components/sooner", element: <SoonerPage/>},
        {path: "components/badges", element: <BadgesPage/>},
        {path: "components/buttons", element: <ButtonsPage/>},
        {path: "components/cards", element: <CardsPage/>},
        {path: "components/list-groups", element: <ListGroupPage/>},
        {path: "components/carousels", element: <CarouselPage/>},
        {path: "components/media-object", element: <AvatarShowcase/>},
        {path: "components/navbars", element: <NavbarsPage/>},
        {path: "components/progress", element: <ProgressPage/>},
        {path: "components/spinners", element: <SpinnerExamples/>},

         // boxicons
        {path: "icons/boxicons", element: <Boxicons/>},
        {path: "icons/bootstrap", element: <IconBootstrap/>},
        {path: "icons/lucide", element: <LucideIconsPage/>},
        {path: "pricing/pricing-tables", element: <PricingPage/>},
        {path: "faq", element: <FAQPage/>},

        // charts
        {path: "charts/recharts", element: <ReChartsPage/>},
        {path: "charts/apex-charts", element: <ApexChartsPage/>},

        // account
        {path: "account/profile", element: <UserProfile/>},
        {path: "account/edit-profile", element: <EditProfile/>},
        {path: "account/password-setting", element: <PasswordSettings/>},
        {path: "account/notifications", element: <NotificationSettings/>},

        // Tables
        {path: "tables/basic-tables", element: <BasicTables/>},
        {path: "tables/advanced-tables", element: <AdvanceTablesPage/>},
        {path: "tables/data-tables", element: <DataTablePage/>},

        // Forms
        {path: "forms/basic-inputs", element: <BasicInput/>},
        {path: "forms/input-groups", element: <FormInputGroup/>},
        {path: "forms/radio-checkboxes", element: <ChecksAndRadios/>},
        {path: "forms/form-layouts", element: <FormLayouts/>},
        {path: "forms/form-wizard", element: <WizardPage/>},
        {path: "forms/text-editor", element: <FormTextEditor/>},
        {path: "forms/file-upload", element: <FileUpload01/>},
        {path: "forms/date-pickers", element: <DatePickerPage/>},
        {path: "forms/select", element: <SelectExamplesPage/>},
        {path: "forms/form-repeat", element: <FormRepeater/>},
        
        
        // ✅ 404 HANDLER
        { path: "*", element: <NotFound /> },
      ],
    },
  ],
  {
    basename: "/axones",
  }
)
