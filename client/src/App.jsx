import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import OverviewPage from './pages/Overview/OverviewPage';
import PropertiesPage from './pages/Properties/PropertiesPage';
import PropertyDetailPage from './pages/Properties/PropertyDetailPage';
import ReviewsPage from './pages/Reviews/ReviewsPage';
import InsightsPage from './pages/Insights/InsightsPage';
import CollectionMonitorPage from './pages/Collection/CollectionMonitorPage';
import DataImportPage from './pages/Import/DataImportPage';
import SettingsPage from './pages/Settings/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Default redirects */}
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="/dashboard" element={<Navigate to="/overview" replace />} />

        {/* 8 Phase 7 Core Pages */}
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/properties/:propertyId" element={<PropertyDetailPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/collection" element={<CollectionMonitorPage />} />
        <Route path="/import" element={<DataImportPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* 404 handler */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
