import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { startAnalyticsIfConsented } from "./hooks/useCookieConsent";
import { I18nProvider } from "./i18n/I18nProvider";
import "./styles.css";

// Google Analytics loads only for visitors who accepted analytics cookies.
startAnalyticsIfConsented();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
);
