import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Sidebar from './components/Sidebar.jsx';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import CompleteInvitePage from './pages/CompleteInvitePage.jsx';
import VerificationBanner from './components/VerificationBanner.jsx';
import DashboardPage from './pages/admin/DashboardPage.jsx';
import ProfessoresPage from './pages/admin/ProfessoresPage.jsx';
import AlunosPage from './pages/admin/AlunosPage.jsx';
import PropostasPage from './pages/admin/PropostasPage.jsx';
import ListasPage from './pages/professor/ListasPage.jsx';
import NovaListaPage from './pages/professor/NovaListaPage.jsx';
import TurmasPage from './pages/professor/TurmasPage.jsx';
import MinhasListasPage from './pages/aluno/MinhasListasPage.jsx';
import RankingPage from './pages/aluno/RankingPage.jsx';
import PerfilPage from './pages/aluno/PerfilPage.jsx';
import QuestoesPage from './pages/QuestoesPage.jsx';
import TelaQuestao from './pages/TelaQuestao.jsx';
import AdicionarQuestao from './pages/AdicionarQuestao.jsx';
import QuizPage from './pages/QuizPage.jsx';
import LivroLibraryPage from './pages/LivroLibraryPage.jsx';
import LivroIndexPage from './pages/LivroIndexPage.jsx';
import LivroCapituloPage from './pages/LivroCapituloPage.jsx';

const THEME_KEY = 'staticlass-theme';
const ROLE_HOME = { admin: '/dashboard', professor: '/listas', aluno: '/minhas-listas' };

function RoleRedirect() {
  const { role } = useAuth();
  return <Navigate to={ROLE_HOME[role] ?? '/dashboard'} replace />;
}

function AppShell() {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <VerificationBanner />
        <Routes>
          <Route path="/" element={<ProtectedRoute><RoleRedirect /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/dashboard" element={<ProtectedRoute roles={['admin']}><DashboardPage /></ProtectedRoute>} />
          <Route path="/professores" element={<ProtectedRoute roles={['admin']}><ProfessoresPage /></ProtectedRoute>} />
          <Route path="/alunos" element={<ProtectedRoute roles={['admin']}><AlunosPage /></ProtectedRoute>} />
          <Route path="/propostas" element={<ProtectedRoute roles={['admin']}><PropostasPage /></ProtectedRoute>} />

          {/* Professor */}
          <Route path="/listas" element={<ProtectedRoute roles={['professor', 'admin']}><ListasPage /></ProtectedRoute>} />
          <Route path="/listas/nova" element={<ProtectedRoute roles={['professor', 'admin']}><NovaListaPage /></ProtectedRoute>} />
          <Route path="/listas/:id" element={<ProtectedRoute roles={['professor', 'admin']}><NovaListaPage /></ProtectedRoute>} />
          <Route path="/turmas" element={<ProtectedRoute roles={['professor', 'admin']}><TurmasPage /></ProtectedRoute>} />

          {/* Aluno */}
          <Route path="/minhas-listas" element={<ProtectedRoute roles={['aluno']}><MinhasListasPage /></ProtectedRoute>} />
          <Route path="/ranking" element={<ProtectedRoute><RankingPage /></ProtectedRoute>} />
          <Route path="/perfil" element={<ProtectedRoute roles={['aluno']}><PerfilPage /></ProtectedRoute>} />

          {/* Questões — admin + professor */}
          <Route path="/questoes" element={<ProtectedRoute roles={['admin', 'professor']}><QuestoesPage /></ProtectedRoute>} />
          <Route path="/questoes/nova" element={<ProtectedRoute roles={['admin', 'professor']}><AdicionarQuestao /></ProtectedRoute>} />
          <Route path="/questoes/:id" element={<ProtectedRoute roles={['admin', 'professor']}><TelaQuestao /></ProtectedRoute>} />

          {/* Quiz — todas as roles */}
          <Route path="/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />

          {/* Livro — todas as roles */}
          <Route path="/livro" element={<ProtectedRoute><LivroLibraryPage /></ProtectedRoute>} />
          <Route path="/livro/:bookSlug" element={<ProtectedRoute><LivroIndexPage /></ProtectedRoute>} />
          <Route path="/livro/:bookSlug/:slug" element={<ProtectedRoute><LivroCapituloPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const theme = (stored === 'dark' || stored === 'light') ? stored : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  return (
    <AuthProvider>
      {import.meta.env.BASE_URL.startsWith('/alt-home/') && (
        <nav className="des-quick-links" aria-label="Links do DES">
          <a className="des-back-link" href="https://des-uem.tailbef376.ts.net/alt-home/graduacao/guia" target="_blank" rel="noopener noreferrer">Guia da Graduação ↗</a>
          <a className="des-back-link" href="/alt-home/aplicativos">← Voltar a Aplicativos</a>
        </nav>
      )}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/complete-invite" element={<CompleteInvitePage />} />
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </AuthProvider>
  );
}
