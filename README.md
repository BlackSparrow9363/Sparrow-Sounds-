### This is a vibe code project 

# 🎧 Sparrow Sounds — Ambient Soundscape Studio

**Sparrow Sounds** is a modern ambient soundscape mixer built with **React, TypeScript, Tailwind CSS, Web Audio API (AudioWorklet), Zustand, Motion, GSAP, and IndexedDB**.

It includes **42 real field recordings** across categories such as:

- 🌧️ Rain & Storm
- 🌿 Nature
- 🏙️ City & Places
- 🐦 Animals & Birds
- 🚆 Transport
- 🎯 Objects & Focus

You can also **upload custom audio files** and save your soundscapes locally using **IndexedDB**.

---

## ✨ Features

- 🎵 42 real ambient field recordings
- 🎚️ Multi-layer sound mixer
- 🔊 Volume, mute, solo, tone, and pan controls
- 📊 Real-time audio visualizer
- 🎧 Web Audio API + AudioWorklet processing
- 📁 Custom `.mp3` / `.wav` audio uploads
- 💾 Local preset storage with IndexedDB
- ⏱️ Sleep timer
- 🔎 Sound library search
- 🎨 Modern responsive UI
- ♿ Accessible keyboard-friendly controls
- ⚡ Built with React + TypeScript + Vite

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React | UI framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Web Audio API | Audio processing |
| AudioWorklet | Audio DSP |
| Zustand | Global state management |
| Motion | UI animations |
| GSAP | Advanced animations |
| IndexedDB | Local persistence |
| Vite | Development & build tooling |

---

# 🚀 Getting Started

## Prerequisites

Before running the project locally, make sure you have the following installed:

- **Node.js** `18.0.0+` recommended
- **Node.js 20+ LTS** ideal
- **npm** — included with Node.js

Verify your installation:

```bash
node -v
npm -v
```

---

## 📥 Installation

### 1. Download and Extract the ZIP

Download the project `.zip` archive and extract it to a location of your choice.

For example:

```text
Desktop/sparrow-sounds
```

or:

```text
Documents/sparrow-sounds
```

---

### 2. Open the Project Folder

Open your terminal and navigate to the extracted project directory:

```bash
cd path/to/sparrow-sounds
```

**Tip:** If you're using VS Code, open the extracted folder using:

**File → Open Folder...**

Then open the integrated terminal with:

```text
Ctrl + `
```

Make sure the terminal is opened inside the project root.

---

### 3. Install Dependencies

Install all required packages defined in `package.json`:

```bash
npm install
```

---

### 4. Start the Development Server

Start the Vite development server:

```bash
npm run dev
```

Once the server starts, open the URL shown in your terminal.

By default:

```text
http://localhost:3000
```

---

# 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the local development server |
| `npm run build` | Builds the application for production into `dist/` |
| `npm run preview` | Locally previews the production build |
| `npm run lint` | Runs TypeScript type-checking with `tsc --noEmit` |

---

# 📁 Project Structure

```text
sparrow-sounds/
├── public/
│   └── sounds/
│       └── ...                     # 42 real ambient .mp3 audio files
│
├── src/
│   ├── components/
│   │   ├── sound/
│   │   │   ├── SoundIcon.tsx
│   │   │   │   # Category & sound source icons
│   │   │   │
│   │   │   ├── SoundLayerCard.tsx
│   │   │   │   # Active mixer channel controls
│   │   │   │   # Volume, Solo, Mute, Tone & Pan
│   │   │   │
│   │   │   └── SoundLibrarySidebar.tsx
│   │   │       # Sound library grid, search & custom upload
│   │   │
│   │   └── ui/
│   │       ├── AccessibleSlider.tsx
│   │       │   # WCAG-compliant ARIA slider
│   │       │   # Keyboard navigation support
│   │       │
│   │       └── PresetsAndTimerPanel.tsx
│   │           # IndexedDB presets & sleep timer UI
│   │
│   ├── db/
│   │   └── indexedDb.ts
│   │       # IndexedDB persistence for presets & uploaded Blobs
│   │
│   ├── lib/
│   │   └── audio/
│   │       ├── AudioEngine.ts
│   │       │   # Web Audio API graph
│   │       │   # AudioWorklet DSP & sleep timer scheduler
│   │       │
│   │       └── soundSynthesis.ts
│   │           # Built-in sound catalog & starter scenes
│   │
│   ├── store/
│   │   └── useAudioStore.ts
│   │       # Zustand global store
│   │
│   ├── types/
│   │   └── audio.ts
│   │       # TypeScript interfaces
│   │
│   ├── visualizer/
│   │   └── AudioVisualizer.tsx
│   │       # 60 FPS canvas spectrum & waveform visualizer
│   │
│   ├── App.tsx
│   │   # Main studio layout
│   │
│   ├── index.css
│   │   # Tailwind CSS & reduced-motion rules
│   │
│   └── main.tsx
│       # React entry point
│
├── index.html
├── package.json
└── vite.config.ts
```

---

# 🐛 Troubleshooting

### 🔇 No sound plays when clicking a card

Modern browsers may block audio playback until the user interacts with the page.

Clicking **Play Soundscape** in the top-right bar or clicking a sound card will automatically resume the browser's `AudioContext`.

---

### ⚠️ Port 3000 is already in use

If another application is using port `3000`, Vite may automatically use the next available port, such as:

```text
http://localhost:3001
```

Alternatively, stop the process currently using port `3000`.

---

### 💾 Resetting Saved Presets or Custom Sounds

Sparrow Sounds stores mixes and uploaded `.wav` / `.mp3` files locally in your browser using **IndexedDB**.

The database is:

```text
sparrow_sounds_db
```

You can manage or clear your saved mixes and custom sounds directly from the **Saved Soundscapes** panel.

---

## 🌌 About

**Sparrow Sounds** is designed to make creating personalized ambient soundscapes simple, immersive, and completely local.

Mix sounds, create your own atmosphere, save your favorite presets, and focus.
