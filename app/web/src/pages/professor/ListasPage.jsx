import ClassroomListsPanel from '../../components/ClassroomListsPanel.jsx';
import { useState, useEffect } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../../components/Topbar.jsx';
import api from '../../services/api.js';

const CRUMBS = [{ label: 'Listas' }];

const STATUS_CHIP = {
  draft: 'chip--neutral',
  published: 'chip--easy',
  closed: 'chip--hard',
};
const STATUS_LABEL = { draft: 'Rascunho', published: 'Publicada', closed: 'Fechada' };

export default function ListasPage() {
  const navigate = useNavigate();
  const [listas, setListas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/lists')
      .then((r) => setListas(r.data))
      .catch(() => setError('Não foi possível carregar as listas.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Topbar crumbs={CRUMBS} />
      <div className="content">
        <ClassroomListsPanel />
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Minhas listas</h1>
            <p className="page-header__subtitle">Crie e gerencie listas de exercícios para suas turmas.</p>
          </div>
          <div className="page-header__actions">
            <button className="btn btn--primary" onClick={() => navigate('/listas/nova')}>
              <Plus size={16} /> Nova lista
            </button>
          </div>
        </div>

        {error && <p className="field__error" style={{ marginBottom: 16 }}>{error}</p>}

        {loading ? (
          <div className="empty-state"><div className="loader" /></div>
        ) : listas.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma lista criada ainda.</p>
            <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => navigate('/listas/nova')}>
              <Plus size={16} /> Criar primeira lista
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {listas.map((lista) => (
              <div
                key={lista.id}
                className="card"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}
                onClick={() => navigate(`/listas/${lista.id}`)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>{lista.title}</span>
                    <span className={`chip ${STATUS_CHIP[lista.status] ?? 'chip--neutral'}`}>
                      {STATUS_LABEL[lista.status] ?? lista.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--text-muted)' }}>
                    {lista.turma_name && <span>Turma: {lista.turma_name}</span>}
                    {lista.deadline && <span>Prazo: {new Date(lista.deadline).toLocaleDateString('pt-BR')}</span>}
                    {lista.submission_count != null && <span>{lista.submission_count} submissões</span>}
                    {lista.avg_score != null && <span>Média: {Math.round(lista.avg_score * 100)}%</span>}
                  </div>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
