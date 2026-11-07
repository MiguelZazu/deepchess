# DeepChess

Analizador de partidas de ajedrez para PC y móvil con **Stockfish 19** (Lite o completo, WebAssembly) ejecutándose en el propio dispositivo.

## Funciones

- **Vincular cuentas** de Chess.com y Lichess solo con el usuario (APIs públicas oficiales, sin contraseña).
- Listado de partidas con filtros (ritmo, resultado, rival/apertura), V/T/D y ratings del perfil.
- **Revisión de partida**: precisión por jugador (método estilo Lichess), clasificación de cada jugada
  (Brillante, Genial, Mejor, Excelente, Buena, Teoría, Imprecisión, Error, Oportunidad perdida, Error grave, Forzada),
  gráfico de evaluación interactivo, explicación de cada jugada y mejor línea.
- **Motores**: Stockfish 19 Lite (≈7 MB) y Stockfish 19 completo (≈95 MB), multihilo en PC/web, un hilo en Android.
- **Motor en vivo** (líneas 1-5, tiempo máximo 3-30 s o profundidad hasta 30), flechas de mejor jugada, variantes libres arrastrando piezas o tocando casillas.
- Detección de aperturas (base de datos CC0 de lichess-org/chess-openings, 3 865 posiciones).
- Relojes del PGN, material capturado, atajos de teclado (← → ↑ ↓, F para girar).
- Pegar PGN o tablero libre. **Cualquier jugada que hagas en el tablero** (variantes o tablero libre, blancas o negras) recibe su símbolo de clasificación y la explicación del entrenador.
- **Entrenar**: problemas con puntuación Elo, racha y temas (8 000 problemas CC0 de Lichess, de 400 a 2 900); contrarreloj de 3 y 5 minutos, supervivencia y racha con récords;
  **cursos de aperturas** en tarjetas: 11 cursos guiados con explicaciones del entrenador (Italiana, Española, Escocesa, Londres, Gambito de Dama,
  Siciliana, Francesa, Caro-Kann, Escandinava, India de Rey, GDR con negras) con errores comunes y trampas, más 117 aperturas de la base de datos
  con comentarios automáticos. Juegas tus jugadas (✓ / ✗), la máquina responde según la variante elegida; una variante sin errores queda aprendida.
  Modos **Práctica** (variante aprendida al azar) y **Aleatorio** (encadena variantes hasta el primer fallo, con racha y récord).
- **Personalización total**: 11 temas + editor de tema propio (fondo, paneles, texto), tipo de letra, esquinas, paneles de cristal, color de acento, fondo (color, degradado o imagen), 12 tableros + colores propios,
  texturas PNG por casilla o imagen de tablero completo, 31 juegos de piezas libres, recoloreado, PNG propio por pieza o juego completo de una vez,
  13 tipos de letra (incluidos sin conexión), iconos de clasificación o símbolos clásicos.
- **Idioma**: español e inglés (Ajustes → selector arriba a la derecha). Las traducciones están en `src/i18n/en.ts`
  (`node scripts/i18n-keys.cjs` lista los textos que faltan).
- Caché de revisiones en IndexedDB y **PWA instalable** que funciona offline (el motor queda en caché).

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173 (también accesible desde el móvil en la misma red)
npm run build      # genera dist/ (estático)
npm run preview
```

`npm run openings` regenera `src/data/openings.json` desde GitHub (no hace falta para compilar).
`node scripts/check-courses.mjs` comprueba que todas las jugadas de los cursos de `src/data/courses.ts` sean legales.

## Arquitectura

| Carpeta | Contenido |
| --- | --- |
| `src/engine` | Wrapper UCI del Web Worker de Stockfish (4 variantes, cola de búsquedas, MultiPV, cancelación, hilos) |
| `src/lib/appearance.ts`, `look.tsx`, `assets.ts` | Temas, tableros, piezas, recoloreado SVG e imágenes subidas (IndexedDB) |
| `src/analysis/review.ts` | Revisión completa: evaluación de cada posición, win%, precisión y clasificación |
| `src/lib/api.ts` | Chess.com Published-Data API y Lichess API |
| `src/views` | Inicio/cuentas, partidas, análisis, ajustes |

Las variantes multihilo necesitan aislamiento cross-origin (`COOP: same-origin` + `COEP: credentialless`):
las ponen el servidor de Vite, `public/_headers` (Netlify/Cloudflare) y Electron. Sin aislamiento (p. ej. Android) se usan las variantes de un hilo.
El motor completo no se precachea en la PWA: se guarda en caché la primera vez que se usa.

`npm run pieces` vuelve a descargar los juegos de piezas desde lichess-org/lila (`--commercial` excluye los de licencia no comercial CC BY-NC).
`npm run puzzles` regenera `src/data/puzzles.json` desde la base de datos de problemas de Lichess (CC0) y `npm run openings` las aperturas.

## Apps nativas

### Windows / macOS / Linux (Electron)

```bash
npm run desktop        # abre la app de escritorio
npm run desktop:win    # release/DeepChess-<v>-setup.exe y -portable.exe
npm run desktop:mac    # (ejecutar en un Mac)
npm run desktop:linux  # AppImage
```

`electron/main.cjs` sirve `dist/` mediante el esquema `app://`, así Web Workers, WASM e IndexedDB funcionan igual que en la web.
Los enlaces externos se abren en el navegador. Sin certificado de firma, Windows SmartScreen mostrará un aviso la primera vez.

> En Windows, si la ruta del proyecto es muy larga (>260 caracteres) NSIS falla: compila desde una ruta corta (p. ej. `C:\dev\deepchess`).

### Android (Capacitor)

Requisitos: JDK 21 y Android SDK 36 (o Android Studio).
En este PC están en `%LOCALAPPDATA%\Programs\Temurin\jdk-21.0.13+9` y `%LOCALAPPDATA%\Android\Sdk`;
antes de compilar define `JAVA_HOME` con la ruta del JDK (`android/local.properties` ya apunta al SDK).

```bash
npm run android:sync   # compila la web y la copia a android/
npm run android:open   # abre Android Studio (Run ▶ o Build > Generate Signed APK/AAB)
npm run android:apk    # APK debug en android/app/build/outputs/apk/debug/
```

Iconos y splash: `npm run icons` y `npx @capacitor/assets generate --android`.

### Publicar (gratis)

**1. Subir el código a GitHub** (obligatorio por la GPL de Stockfish, y es lo que usan los pasos 2 y 3):

```bash
git init
git add .
git commit -m "DeepChess 0.1.0"
git branch -M main
git remote add origin https://github.com/<usuario>/deepchess.git
git push -u origin main
```

**2. Web en GitHub Pages** → `https://<usuario>.github.io/deepchess/`

En el repositorio: *Settings → Pages → Source: GitHub Actions*. Cada `push` a `main` ejecuta
`.github/workflows/deploy-web.yml`, que compila con la ruta base correcta y publica `dist/`.
GitHub Pages no permite cabeceras COOP/COEP, así que el motor funciona en modo de un hilo (más lento).
Para multihilo, publica en Netlify o Cloudflare Pages, que leen `public/_headers` (Cloudflare limita los
archivos a 25 MB: el Stockfish 19 completo, de 95 MB, no cabe; el Lite sí).

**3. APK firmado en GitHub Releases**

Crea una clave de firma una sola vez, fuera del proyecto, y guárdala (si la pierdes no podrás publicar
actualizaciones que se instalen encima de la versión anterior):

```bash
keytool -genkeypair -v -keystore deepchess-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias deepchess
```

- En local: copia `android/keystore.properties.example` a `android/keystore.properties`, rellénalo y ejecuta
  `npm run android:release` (APK en `android/app/build/outputs/apk/release/`).
- En GitHub: *Settings → Secrets and variables → Actions* y crea `ANDROID_KEYSTORE_BASE64` (el `.jks` en base64:
  `[Convert]::ToBase64String([IO.File]::ReadAllBytes("deepchess-release.jks"))` en PowerShell),
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD`. Después:

```bash
git tag v0.1.0
git push origin v0.1.0
```

`.github/workflows/build-apps.yml` compila el APK firmado y los `.exe`, y crea una Release con ellos y sus SHA-256.

Los archivos `*.jks`, `*.keystore` y `android/keystore.properties` están en `.gitignore`: no los subas nunca.

### Web / PWA

Además de GitHub Pages, sirve `dist/` en cualquier hosting estático (Netlify, Cloudflare Pages, Vercel). Para
una subcarpeta compila con `BASE=/carpeta/ npm run build`. En el móvil: "Añadir a pantalla de inicio"; en PC:
"Instalar" en Chrome/Edge.

## Seguridad

- **Sin servidor ni cuentas:** los datos (partidas, ajustes, progreso, imágenes) se guardan solo en el dispositivo.
  Solo se conecta a `api.chess.com` y `lichess.org` (datos públicos, HTTPS).
- **Content-Security-Policy** (en `vite.config.ts`, solo en producción): solo se ejecuta código propio
  (+ WASM de Stockfish) y la red se limita a esas dos APIs.
- **Enlaces:** solo se abren URLs `http(s)` (`src/lib/safeUrl.ts`); un PGN con `[Link "javascript:…"]` se ignora.
- **Imágenes subidas:** se redibujan en un canvas y se guardan como PNG/JPEG, así que un SVG con scripts no llega a ejecutarse.
- **Electron:** `contextIsolation`, `sandbox`, sin Node en la página, permisos (cámara, micro…) denegados, protocolo
  `app://` con protección de rutas y solo enlaces http(s) hacia el navegador.
- **Fuentes incluidas** en la app (sin peticiones a Google Fonts).
- `npm audit --omit=dev`: 0 vulnerabilidades en lo que se distribuye.

## Licencias

Las piezas incluidas mantienen la licencia de sus autores (ver Ajustes → Datos → Créditos y `src/data/pieceSets.json`).
Stockfish es GPLv3; si distribuyes la app debes publicar el código fuente bajo GPLv3. DeepChess no está afiliado a Chess.com ni a Lichess.
