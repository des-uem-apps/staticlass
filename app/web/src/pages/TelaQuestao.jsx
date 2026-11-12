import QuestionText from '../components/QuestionText.jsx';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Check, X, FilePen } from 'lucide-react';
import Topbar from '../components/Topbar.jsx';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function TelaQuestao() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { role } = useAuth();

  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSelected(null);
    setSubmitted(false);
    setLoading(true);
    api.get(`/questions/${id}`)
      .then((r) => setQuestion(r.data))
      .catch(() => setError('Questão não encontrada.'))
      .finally(() => setLoading(false));
  }, [id]);

  const CRUMBS = [
    { label: 'Questões', to: '/questoes' },
    { label: question ? `Questão #${question.id}` : `#${id}` },
  ];

  const alternatives = question?.alternatives ?? [];
  const correct = question?.correct_answer ?? '';

  const altClass = (letter) => {
    if (!submitted) return selected === letter ? 'alt alt--selected' : 'alt';
    if (letter === correct) return 'alt alt--correct';
    if (letter === selected) return 'alt alt--wrong';
    return 'alt';
  };

  const difficultyChip = { 1: 'chip--easy', 2: 'chip--medium', 3: 'chip--hard' };
  const difficultyLabel = { 1: 'Fácil', 2: 'Médio', 3: 'Difícil' };

  if (loading) return (
    <>
      <Topbar crumbs={[{ label: 'Questões', to: '/questoes' }, { label: `#${id}` }]} />
      <div className="empty-state" style={{ marginTop: 80 }}><div className="loader" /></div>
    </>
  );

  if (error) return (
    <>
      <Topbar crumbs={[{ label: 'Questões', to: '/questoes' }]} />
      <div className="empty-state" style={{ marginTop: 80 }}><p style={{ color: 'var(--danger-500)' }}>{error}</p></div>
    </>
  );

  return (
    <>
      <Topbar crumbs={CRUMBS} />
      <div className="content content--detail">
        <div>
          <div className="page-header">
            <div>
              <h1 className="page-header__title">Questão #{question.id}</h1>
              <p className="page-header__subtitle">
                Pré-visualização — como o aluno verá esta questão.
              </p>
            </div>
            <div className="page-header__actions">
              <button className="btn btn--ghost" onClick={() => navigate('/questoes')}>
                <ArrowLeft size={16} /> Voltar
              </button>
              {question.can_manage ? (
                <button className="btn btn--secondary" onClick={() => navigate(`/questoes/nova?edit=${question.id}`)}>
                  Editar
                </button>
              ) : role === 'professor' ? (
                <button
                  className="btn btn--secondary"
                  title="Suas alterações serão enviadas para revisão do administrador"
                  onClick={() => navigate(`/questoes/nova?propose=${question.id}`)}
                >
                  <FilePen size={15} /> Propor alteração
                </button>
              ) : null}
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {question.difficulty && (
                <span className={`chip ${difficultyChip[question.difficulty] ?? 'chip--neutral'}`}>
                  {difficultyLabel[question.difficulty] ?? question.difficulty}
                </span>
              )}
              {question.topic_name && <span className="chip chip--neutral">{question.topic_name}</span>}
              {question.chapter_name && <span className="chip chip--neutral">{question.chapter_name}</span>}
              {question.estimated_time && (
                <span className="chip chip--neutral" style={{ marginLeft: 'auto' }}>
                  <Clock size={12} /> {question.estimated_time}
                </span>
              )}
            </div>

            <QuestionText text={question.issue} style={{ fontSize: 17, lineHeight: 1.6, margin: '0 0 24px', maxWidth: '65ch' }} />

            <div className="alt-list" role="radiogroup" aria-label="Alternativas">
              {alternatives.map(({ letter, text }) => (
                <div
                  key={letter}
                  className={altClass(letter)}
                  onClick={() => !submitted && setSelected(letter)}
                  role="radio"
                  aria-checked={selected === letter}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && !submitted && setSelected(letter)}
                >
                  <div className="alt__letter">{letter}</div>
                  <QuestionText className="alt__text" text={text} />
                  {submitted && letter === correct && (
                    <Check size={20} style={{ color: 'var(--success-600)', flexShrink: 0 }} />
                  )}
                  {submitted && letter === selected && letter !== correct && (
                    <X size={20} style={{ color: 'var(--danger-600)', flexShrink: 0 }} />
                  )}
                </div>
              ))}
            </div>

            <div className="q-footer">
              <div />
              <div style={{ display: 'flex', gap: 8 }}>
                {submitted ? (
                  <button className="btn btn--secondary" onClick={() => { setSubmitted(false); setSelected(null); }}>
                    Reiniciar
                  </button>
                ) : (
                  <button
                    className="btn btn--primary"
                    disabled={!selected}
                    onClick={() => setSubmitted(true)}
                  >
                    Confirmar resposta
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="side-panel">
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">Metadados</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
              {question.source && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Fonte</span>
                  <span>{question.source}</span>
                </div>
              )}
              {question.section && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Seção</span>
                  <span>{question.section}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Alternativas</span>
                <span>{alternatives.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Correta</span>
                <span style={{ fontWeight: 700, color: 'var(--success-600)' }}>{correct}</span>
              </div>
            </div>
          </div>

          {submitted && question.solution && (
            <div className="card">
              <div className="card__header">
                <h2 className="card__title">Resolução</h2>
              </div>
              <QuestionText text={question.solution} style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)' }} />
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
