import ClassroomListsPanel from '../../components/ClassroomListsPanel.jsx';
import { useState, useEffect } from 'react';
import { Clock, CheckCircle, Circle } from 'lucide-react';
import Topbar from '../../components/Topbar.jsx';
import api from '../../services/api.js';

const CRUMBS = [{ label: 'Minhas listas' }];

export default function MinhasListasPage() {
  const [listas, setListas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/lists/assigned')
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
            <p className="page-header__subtitle">Listas de exercícios atribuídas pelos seus professores.</p>
          </div>
        </div>

        {error && <p className="field__error" style={{ marginBottom: 16 }}>{error}</p>}

        {loading ? (
          <div className="empty-state"><div className="loader" /></div>
        ) : listas.length === 0 ? (
          <div className="empty-state">
            <Circle size={40} style={{ color: 'var(--text-subtle)', marginBottom: 12 }} />
            <p>Nenhuma lista atribuída ainda.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {listas.map((lista) => {
              const submitted = lista.my_submission != null;
              const overdue = lista.deadline && new Date(lista.deadline) < new Date() && !submitted;
              return (
                <div key={lista.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flexShrink: 0 }}>
                    {submitted
                      ? <CheckCircle size={24} style={{ color: 'var(--success-500)' }} />
                      : <Circle size={24} style={{ color: overdue ? 'var(--danger-500)' : 'var(--text-subtle)' }} />
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, marginBottom: 4 }}>{lista.title}</div>
                    <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-muted)' }}>
                      {lista.professor_name && <span>Prof. {lista.professor_name}</span>}
                      {lista.deadline && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: overdue ? 'var(--danger-500)' : undefined }}>
                          <Clock size={12} /> {new Date(lista.deadline).toLocaleDateString('pt-BR')}
                          {overdue && ' — Expirada'}
                        </span>
                      )}
                    </div>
                  </div>
                  {submitted && lista.my_submission?.score != null && (
                    <div className="stat" style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span className="stat__value" style={{ fontSize: 22 }}>
                        {Math.round(lista.my_submission.score * 100)}%
                      </span>
                      <span className="stat__label">nota</span>
                    </div>
                  )}
                  {!submitted && (
                    <span className={`chip ${overdue ? 'chip--hard' : 'chip--medium'}`}>
                      {overdue ? 'Expirada' : 'Pendente'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
