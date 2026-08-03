# Frontend del Blog Educativo

Aplicación en React + Vite + Tailwind CSS para el blog educativo sobre reproducción humana.

## Requisitos

- Node.js 18 o superior
- npm (viene con Node.js)

## Instalación

```bash
cd frontend
npm install
```

## Ejecutar en desarrollo

```bash
npm run dev
```

La aplicación se abre en `http://localhost:5173`.

## Compilar para producción

```bash
npm run build
```

## Conexión con la API

El archivo `vite.config.js` redirige las peticiones a `/api` hacia `http://localhost:8000`.

Para usar datos reales, inicia la API:

```bash
cd api
python app.py
```

Para usar datos simulados, cambia `USE_MOCK = true` en `src/contexts/DataContext.jsx`.

## Estructura

- `src/components/ui/` - Componentes base (Button, Card, Badge, ProgressBar, etc.)
- `src/components/layout/` - AppLayout con navegación responsive
- `src/pages/` - Páginas por funcionalidad
- `src/services/` - Llamadas a la API
- `src/data/` - Datos simulados
- `src/contexts/` - Estados globales (AuthContext, DataContext)
- `src/utils/` - Helpers de formato
