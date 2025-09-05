// src/main.tsx
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { LanguageProvider } from "./hooks/useLanguage";
import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </LanguageProvider>
);