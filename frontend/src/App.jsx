import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { WebSocketProvider } from './contexts/WebSocketContext'
import ErrorBoundary from './components/layout/ErrorBoundary'

// Layouts
import StudentLayout from './components/layout/StudentLayout'
import TeacherLayout from './components/layout/TeacherLayout'
import ProtectedRoute from './components/layout/ProtectedRoute'

// Auth
import LoginPage from './pages/auth/LoginPage'

// Student pages
import FeedPage from './pages/feed/FeedPage'
import ExplorePage from './pages/explore/ExplorePage'
import CreatePage from './pages/create/CreatePage'
import MyRoutePage from './pages/my-route/MyRoutePage'
import ProfilePage from './pages/profile/ProfilePage'
import TeacherProfilePage from './pages/profile/TeacherProfilePage'

// Content pages (shared between student & teacher)
import PublicationsPage from './pages/publications/PublicationsPage'
import PublicationDetailPage from './pages/publications/PublicationDetailPage'
import ActivitiesPage from './pages/activities/ActivitiesPage'
import ActivityDetailPage from './pages/activities/ActivityDetailPage'
import ActivityResultPage from './pages/activities/ActivityResultPage'
import ResourcesPage from './pages/resources/ResourcesPage'
import TeacherResourcesPage from './pages/resources/TeacherResourcesPage'
import ProgressPage from './pages/progress/ProgressPage'

// Game Engine pages
import GameLauncherPage from './pages/game/GameLauncherPage'
import GameRoomPage from './pages/game/GameRoomPage'
import GameJoinPage from './pages/game/GameJoinPage'
import TeacherCreatorPage from './pages/teacher/TeacherCreatorPage'

// Teacher/Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import ModerationPage from './pages/moderation/ModerationPage'
import ClassEventsPage from './pages/admin/ClassEventsPage'
import UsersPage from './pages/admin/UsersPage'
import ResearchPage from './pages/admin/ResearchPage'

// Not found
import NotFoundPage from './pages/NotFoundPage'

function App() {
  return (
    <WebSocketProvider>
      <ErrorBoundary>
      <Routes>
        {/* ═══ Única ruta pública ═══ */}
        <Route path="/login" element={<LoginPage />} />

        {/* ═══ Rutas de ESTUDIANTE ═══ */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<FeedPage />} />
          <Route path="explorar"    element={<ExplorePage />} />
          <Route path="crear"       element={<CreatePage />} />
          <Route path="mi-ruta"     element={<MyRoutePage />} />
          <Route path="perfil"      element={<ProfilePage />} />

          {/* Contenido educativo y Game Engine */}
          <Route path="juegos"                element={<GameLauncherPage />} />
          <Route path="sala"                  element={<GameJoinPage />} />
          <Route path="sala/:code"            element={<GameJoinPage />} />
          <Route path="lecturas"              element={<PublicationsPage />} />
          <Route path="lecturas/:slug"        element={<PublicationDetailPage />} />
          <Route path="actividades"           element={<ActivitiesPage />} />
          <Route path="actividades/:id"       element={<ActivityDetailPage />} />
          <Route path="actividades/:id/resultado" element={<ActivityResultPage />} />
          <Route path="recursos"             element={<ResourcesPage />} />
          <Route path="progreso"             element={<ProgressPage />} />

          {/* Rutas legacy → redirigir */}
          <Route path="ruta" element={<Navigate to="/mi-ruta" replace />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* ═══ Rutas de DOCENTE / ADMINISTRADOR ═══ */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['administrador', 'docente']} redirectTo="/">
              <TeacherLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="moderar"      element={<ModerationPage />} />
          <Route path="eventos"      element={<ClassEventsPage />} />
          <Route path="progreso"     element={<ProgressPage />} />
          <Route path="usuarios"     element={<UsersPage />} />
          <Route path="investigacion" element={<ResearchPage />} />
          <Route path="perfil"       element={<TeacherProfilePage />} />

          {/* Creación de contenido y Game Creator */}
          <Route path="crear"        element={<CreatePage />} />
          <Route path="crear-juego"  element={<TeacherCreatorPage />} />
          <Route path="juegos"       element={<GameLauncherPage />} />
          <Route path="sala/:code"   element={<GameRoomPage />} />

          {/* Vistas de contenido en contexto admin */}
          <Route path="lecturas"              element={<PublicationsPage />} />
          <Route path="lecturas/:slug"        element={<PublicationDetailPage />} />
          <Route path="actividades"           element={<ActivitiesPage />} />
          <Route path="actividades/:id"       element={<ActivityDetailPage />} />
          <Route path="actividades/:id/resultado" element={<ActivityResultPage />} />
          <Route path="recursos"             element={<TeacherResourcesPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Fallback global */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </ErrorBoundary>
    </WebSocketProvider>
  )
}

export default App
