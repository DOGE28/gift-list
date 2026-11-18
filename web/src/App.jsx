import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import EventDetailPage from './pages/EventDetailPage.jsx';
import GuestAddPage from './pages/GuestAddPage.jsx';
import ChangeCredentialsPage from './pages/ChangeCredentialsPage.jsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:eventId"
        element={
          <ProtectedRoute>
            <EventDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/change-credentials"
        element={
          <ProtectedRoute>
            <ChangeCredentialsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/g/:token" element={<GuestAddPage />} />
    </Routes>
  );
}

export default App;
