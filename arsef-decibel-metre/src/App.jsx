import { Routes, Route, Navigate } from 'react-router-dom';
import AdminPage from './pages/AdminPage';
import DisplayPage from './pages/DisplayPage';
import TestPage from './pages/TestPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/display" element={<DisplayPage />} />
      <Route path="/test" element={<TestPage />} />
    </Routes>
  );
}

export default App;
