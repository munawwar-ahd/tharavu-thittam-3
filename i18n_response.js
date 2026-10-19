import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/i18n.tsx");const createContext = __vite__cjsImport0_react["createContext"]; const useContext = __vite__cjsImport0_react["useContext"]; const useState = __vite__cjsImport0_react["useState"]; const useCallback = __vite__cjsImport0_react["useCallback"];const _jsxDEV = __vite__cjsImport1_react_jsxDevRuntime["jsxDEV"];// i18n.ts â Centralized internationalization system for TamilVault AI
import __vite__cjsImport0_react from "/node_modules/.vite/deps/react.js?v=ed32d50d";
var _jsxFileName = "C:/Users/munaw/Documents/TAMIL HACK FEST/tamil-hack-fest-2-main/frontend/src/i18n.tsx";
import __vite__cjsImport1_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=ed32d50d";
var _s = $RefreshSig$(), _s2 = $RefreshSig$();
// English translations (base)
const en = {
	// App header/title
	"app.title": "à®¤à®°à®µà¯ à®¤à®¿à®à¯à®à®®à¯ - DATA PLAN",
	"app.subtitle": "TamilVault AI â Historical Tamil OCR & Translation",
	// Status chip (backend status)
	"status.backend_offline": "Backend offline",
	"status.api_error": "API error {{status}}",
	"status.unexpected_response": "Unexpected response",
	"status.connecting": "Connectingâ¦",
	"status.ready": "Ready â {{model}}",
	"status.engine_unavailable": "Engine unavailable",
	"status.api_key_not_set": "API key not set",
	"status.ocr_not_ready": "OCR not ready",
	// Upload section
	"upload.heading": "à®¤à®°à®µà¯ à®¤à®¿à®à¯à®à®®à¯ - DATA PLAN",
	"upload.drop_text": "Drop image",
	"upload.drop_subtext": "JPEG Â· PNG Â· TIFF Â· BMP",
	"upload.filename": "{{name}}",
	"upload.filesize": "{{size}} KB{{type}}",
	"upload.replace": "Replace",
	"upload.remove": "Remove",
	"upload.aria_label_empty": "Drop zone â drop an image here or click to browse",
	"upload.aria_label_filled": "Image selected",
	"upload.error_unsupported": "Unsupported file type. Use JPEG, PNG, TIFF, or BMP.",
	"upload