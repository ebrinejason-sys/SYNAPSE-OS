import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { OSLayout } from './components/layout/OSLayout';

import LandingPage from './pages/LandingPage';
import Login from './pages/auth/Login';
import SignUp from './pages/auth/SignUp';
import PilotApply from './pages/marketing/PilotApply';
import DemoSandbox from './pages/demo/DemoSandbox';
import DoctorQueue from './pages/os/DoctorQueue';
import EncounterScreen from './pages/os/EncounterScreen';
import DoctorTeleDashboard from './pages/os/DoctorTeleDashboard';
import AuditLog from './pages/os/AuditLog';
import PatientDashboard from './pages/app/PatientDashboard';
import TelemedicinePage from './pages/tele/TelemedicinePage';
import BookingPage from './pages/tele/BookingPage';
import BookingConfirmedPage from './pages/tele/BookingConfirmedPage';
import VideoRoomPage from './pages/tele/VideoRoomPage';
import AdminDashboard from './pages/admin/AdminDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/apply" element={<PilotApply />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        {/* Telemedicine */}
        <Route path="/tele" element={<TelemedicinePage />} />
        <Route path="/tele/booking" element={<BookingPage />} />
        <Route path="/tele/booked/:id" element={<BookingConfirmedPage />} />
        <Route path="/tele/room/:id" element={<VideoRoomPage />} />

        {/* Demo sandbox */}
        <Route path="/demo/*" element={<DemoSandbox />} />

        {/* Clinical OS — wrapped in OS shell */}
        <Route path="/os/doctor/queue" element={<OSLayout><DoctorQueue /></OSLayout>} />
        <Route path="/os/doctor/tele" element={<OSLayout><DoctorTeleDashboard /></OSLayout>} />
        <Route path="/os/doctor/encounter/:id" element={<OSLayout><EncounterScreen /></OSLayout>} />
        <Route path="/os/audit" element={<OSLayout><AuditLog /></OSLayout>} />

        {/* Patient app — app.synapseos.tech */}
        <Route path="/app/dashboard" element={<PatientDashboard />} />

        {/* Admin — admin.synapseos.tech */}
        <Route path="/admin" element={<AdminDashboard />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
