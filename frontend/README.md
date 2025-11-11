# Jetson Chat Frontend

Dunkles, modernes React-Interface (Vite + TypeScript + Tailwind + shadcn/ui) für das FastAPI-Gateway aus Prompt 1. Unterstützt WebSocket-Streaming (mit SSE-Fallback), Markdown mit Code-Highlighting, Verlaufsexport/import sowie konfigurierbare Parameter.

## Features
- Live-Streaming via `ws://localhost:8000/ws/chat` mit Auto-Reconnect; automatische Umschaltung auf SSE (`/api/chat?stream=true`) wenn WS nicht verfügbar.
- Modell-Auswahl, Temperatur-/Top-p-Slider, Seed-Eingabe, Verlauf löschen sowie Export/Import im JSON-Format.
- Persistente Chat-History & Settings (Backend-URLs, API-Key) in `localStorage`.
- Moderne UI-Komponenten (shadcn Button/Card/etc.), Markdown-Renderer mit Copy-Buttons, Statusbar für Latenz/Tokens/Verbindungsstatus.
- Fehler-Toasts, Abbruch-Button, responsive Layout (Mobile → Desktop) und Fokuszustände für A11y.

## Voraussetzungen
- Node.js ≥ 18
- pnpm (empfohlen). Alternativ `npm`/`yarn` nutzbar, ersetze Befehle entsprechend.

## Installation & Start
```bash
cd frontend
pnpm install
pnpm dev -- --host
```
Vite läuft standardmäßig auf `http://localhost:5173`. Stelle sicher, dass das Backend unter `http://localhost:8000` (WS: `ws://localhost:8000/ws/chat`) erreichbar ist und CORS diese Origin bereits erlaubt (laut Backend-Vorgabe ✅).

## Konfiguration
- Öffne das Settings-Panel (Zahnradsymbol) um HTTP-/WS-Basen sowie optionalen `x-api-key` zu setzen; Werte werden in `localStorage` persistiert.
- Modell-Liste wird via `GET /api/models` geladen. Bei Fehlern bleibt das zuletzt gewählte Modell aktiv.

## Build & Preview
```bash
cd frontend
pnpm build
pnpm preview -- --host
```
Das erzeugt den Produktionsbuild in `dist/` und startet anschließend eine Vorschau auf Port 4173.

## Tests / Qualität
- Vite + TypeScript + ESLint-ähnliche Typprüfung (via `tsc --noEmit`, optional).
- Für automatisierte UI-Tests kannst du Playwright/Cypress hinzufügen; aktuell liegt der Fokus auf manuellem Smoke-Testing.

## Deployment-Hinweise
- Hinter einer Reverse-Proxy-SSL-Terminierung (`https://`). Passe in den Settings die HTTP/WS-URLs (z. B. `https://chat.example` & `wss://chat.example/ws/chat`) an.
- Stelle sicher, dass der Backend-Server CORS für deine Frontend-Origin erlaubt und ggf. `x-api-key` erwartet.
