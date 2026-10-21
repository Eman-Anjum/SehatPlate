import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AuthPage from './pages/AuthPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route path="*" element={<AuthPage />} />
    </Routes>
  );
}
