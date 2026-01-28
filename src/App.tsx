import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import { HomePage } from './pages/HomePage';
import { PlacePage } from './pages/PlacePage';
import { CalendarPage } from './pages/CalendarPage';
import { SettingsPage } from './pages/SettingsPage';
import { TabsPage } from './pages/TabsPage';
import { SearchPage } from './pages/SearchPage';

function App() {
  const basename = import.meta.env.BASE_URL;

  return (
    <ToastProvider>
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/place/:id" element={<PlacePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/tabs" element={<TabsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
