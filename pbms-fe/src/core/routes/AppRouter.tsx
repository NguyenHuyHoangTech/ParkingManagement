import { useEffect, Suspense, lazy } from 'react';
import axiosClient from '../api/axiosClient';
import { setSimulatedOffset } from '../utils/timeProvider';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { GlobalLoading } from '../../features/shared/components/GlobalLoading';
import { IdleTimeoutGuard } from '../../features/shared/components/IdleTimeoutGuard';
import { useWebSocket } from '../websocket/useWebSocket';

const LoginScreen = lazy(() => import('../../features/auth/LoginScreen').then(m => ({ default: m.LoginScreen })));
const BuildingProfileScreen = lazy(() => import('../../features/system/BuildingProfileScreen').then(m => ({ default: m.BuildingProfileScreen })));
const SystemConfigScreen = lazy(() => import('../../features/system/SystemConfigScreen').then(m => ({ default: m.SystemConfigScreen })));
const AuditLogScreen = lazy(() => import('../../features/admin/AuditLogScreen').then(m => ({ default: m.AuditLogScreen })));
const GateConsoleScreen = lazy(() => import('../../features/staff/GateConsoleScreen').then(m => ({ default: m.GateConsoleScreen })));
const ShiftManagementScreen = lazy(() => import('../../features/staff/ShiftManagementScreen').then(m => ({ default: m.ShiftManagementScreen })));
const ExceptionDeskScreen = lazy(() => import('../../features/staff/ExceptionDeskScreen').then(m => ({ default: m.ExceptionDeskScreen })));
const HomeScreen = lazy(() => import('../../features/customer/HomeScreen').then(m => ({ default: m.HomeScreen })));
const PreBookingScreen = lazy(() => import('../../features/customer/PreBookingScreen').then(m => ({ default: m.PreBookingScreen })));
const MyParkingScreen = lazy(() => import('../../features/customer/MyParkingScreen').then(m => ({ default: m.MyParkingScreen })));
const HelpdeskScreen = lazy(() => import('../../features/customer/HelpdeskScreen').then(m => ({ default: m.HelpdeskScreen })));
const CustomerMonthlyPassScreen = lazy(() => import('../../features/customer/CustomerMonthlyPassScreen').then(m => ({ default: m.CustomerMonthlyPassScreen })));
const CustomerRulesScreen = lazy(() => import('../../features/customer/CustomerRulesScreen').then(m => ({ default: m.CustomerRulesScreen })));
const UserManagementScreen = lazy(() => import('../../features/admin/UserManagementScreen').then(m => ({ default: m.UserManagementScreen })));
const VehicleTypeScreen = lazy(() => import('../../features/manager/VehicleTypeScreen').then(m => ({ default: m.VehicleTypeScreen })));
const SpaceMapScreen = lazy(() => import('../../features/manager/SpaceMapScreen').then(m => ({ default: m.SpaceMapScreen })));
const PricingConfigScreen = lazy(() => import('../../features/manager/PricingConfigScreen').then(m => ({ default: m.PricingConfigScreen })));
const PenaltyConfigScreen = lazy(() => import('../../features/manager/PenaltyConfigScreen').then(m => ({ default: m.PenaltyConfigScreen })));
const MonthlyPassScreen = lazy(() => import('../../features/manager/MonthlyPassScreen').then(m => ({ default: m.MonthlyPassScreen })));
const RevenueDashboardScreen = lazy(() => import('../../features/manager/RevenueDashboardScreen').then(m => ({ default: m.RevenueDashboardScreen })));
const OperationalDashboardScreen = lazy(() => import('../../features/manager/OperationalDashboardScreen').then(m => ({ default: m.OperationalDashboardScreen })));
const RefundManagementScreen = lazy(() => import('../../features/manager/RefundManagementScreen').then(m => ({ default: m.RefundManagementScreen })));
const CardManagementScreen = lazy(() => import('../../features/manager/CardManagementScreen').then(m => ({ default: m.CardManagementScreen })));
const VehicleRoutingScreen = lazy(() => import('../../features/manager/VehicleRoutingScreen').then(m => ({ default: m.VehicleRoutingScreen })));
const PreBookingManagementScreen = lazy(() => import('../../features/manager/PreBookingManagementScreen').then(m => ({ default: m.PreBookingManagementScreen })));

const ManagerLayout = lazy(() => import('../../features/manager/ManagerLayout').then(m => ({ default: m.ManagerLayout })));
const StaffLayout = lazy(() => import('../../features/staff/StaffLayout').then(m => ({ default: m.StaffLayout })));
const CustomerLayout = lazy(() => import('../../features/customer/CustomerLayout').then(m => ({ default: m.CustomerLayout })));
const AdminLayout = lazy(() => import('../../features/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const role = useAuthStore((state) => state.role);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role && !allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />; // or to a forbidden page
  }

  return <>{children}</>;
};

export const AppRouter = () => {
  const { stompClient, connected } = useWebSocket();
  const email = useAuthStore(state => state.email);
  const logout = useAuthStore(state => state.logout);

  useEffect(() => {
    if (stompClient && connected && email) {
      const sub = stompClient.subscribe('/topic/identity/users', (msg) => {
        try {
          const data = JSON.parse(msg.body);
          if (data.action === 'UPDATE' && data.email === email) {
            logout();
          }
        } catch (e) { }
      });
      return () => sub.unsubscribe();
    }
  }, [stompClient, connected, email, logout]);

  useEffect(() => {
    // Fetch time offset on startup
    axiosClient.get('/public/time-offset').then((res: any) => {
      const offset = res.data?.data;
      if (typeof offset === 'number') {
        setSimulatedOffset(offset);
      }
    }).catch((e: any) => console.error('Failed to fetch time offset', e));
  }, []);

  return (
    <BrowserRouter>
      <IdleTimeoutGuard />
      <Suspense fallback={<GlobalLoading />}>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />

          {/* ADMIN LAYOUT ROUTES */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ROLE_SUPER_ADMIN', 'ROLE_ADMIN']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="system-configs" element={<SystemConfigScreen />} />
            <Route path="audit-logs" element={<AuditLogScreen />} />
            <Route path="users" element={<UserManagementScreen />} />
          </Route>

          {/* MANAGER LAYOUT ROUTES */}
          <Route
            path="/manager"
            element={
              <ProtectedRoute allowedRoles={['ROLE_MANAGER']}>
                <ManagerLayout />
              </ProtectedRoute>
            }
          >
            <Route path="building-profile" element={<BuildingProfileScreen />} />
            <Route path="vehicle-types" element={<VehicleTypeScreen />} />
            <Route path="space-map" element={<SpaceMapScreen />} />
            <Route path="pricing-config" element={<PricingConfigScreen />} />
            <Route path="penalty-config" element={<PenaltyConfigScreen />} />
            <Route path="monthly-passes" element={<MonthlyPassScreen />} />
            <Route path="refund-management" element={<RefundManagementScreen />} />
            <Route path="revenue-dashboard" element={<RevenueDashboardScreen />} />
            <Route path="operational-dashboard" element={<OperationalDashboardScreen />} />
            <Route path="card-management" element={<CardManagementScreen />} />
            <Route path="routing" element={<VehicleRoutingScreen />} />
            <Route path="pre-bookings" element={<PreBookingManagementScreen />} />
            <Route path="incidents" element={<ExceptionDeskScreen />} />
          </Route>

          {/* CUSTOMER LAYOUT ROUTES */}
          <Route
            path="/customer"
            element={
              <ProtectedRoute allowedRoles={['ROLE_CUSTOMER']}>
                <CustomerLayout />
              </ProtectedRoute>
            }
          >
            <Route path="home" element={<HomeScreen />} />
            <Route path="pre-booking" element={<PreBookingScreen />} />
            <Route path="my-parking" element={<MyParkingScreen />} />
            <Route path="monthly-pass" element={<CustomerMonthlyPassScreen />} />
            <Route path="helpdesk" element={<HelpdeskScreen />} />
            <Route path="rules" element={<CustomerRulesScreen />} />
          </Route>

          {/* STAFF LAYOUT ROUTES */}
          <Route
            path="/staff"
            element={
              <ProtectedRoute allowedRoles={['ROLE_STAFF']}>
                <StaffLayout />
              </ProtectedRoute>
            }
          >
            <Route path="gate-console" element={<GateConsoleScreen />} />
            <Route path="shift-management" element={<ShiftManagementScreen />} />
            <Route path="exception-desk" element={<ExceptionDeskScreen />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};
