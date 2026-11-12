import QuestionText from '../components/QuestionText.jsx';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, RotateCcw } from 'lucide-react';
import Topbar from '../components/Topbar.jsx';
import api from '../services/api.js';

const CRUMBS = [{ label: 'Quiz' }];
const DIFFICULTY_LABEL = { 1: 'Fácil', 2: 'Médio', 3: 'Difícil' };
const DIFFICULTY_CHIP  = { 1: 'chip--easy', 2: 'chip--medium', 3: 'chip--hard' };

// ── Filter phase ──────────────────────────────────────────────────────────────

function FilterPhase({ onStart }) {
  const [chapters, setChapters] = useState([]);
  const [qtd, setQtd]           = useState(5);
  const [chapterId, setChapterId] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    api.get('/questions/chapters').then((r) => setChapters(r.data)).catch(() => {});
  }, []);

  const handleStart = async () => {
    setLoading(true);
    try {
      const params = { num: qtd };
      if (chapterId)  params.chapter_id  = chapterId;
      if (difficulty) params.difficulty   = difficulty;
      const r = await api.get('/questions/filtered', { params });
      if (!r.data.length) return alert('Nenhuma questão encontrada para os filtros selecionados.');
      onStart(r.data);
    } catch {
      alert('Erro ao buscar questões. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Topbar crumbs={CRUMBS} />
      <div className="content content--narrow">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Quiz</h1>
            <p className="page-header__subtitle">Escolha os filtros e inicie um quiz aleatório.</p>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div className="field">
              <label className="field__label">Quantidade de questões</label>
              <input
                type="number"
                className="input"
                min={1}
                max={20}
                value={qtd}
                onChange={(e) => setQtd(Math.min(20, Math.max(1, Number(e.target.value))))}
                style={{ width: 120 }}
              />
            </div>

            <div className="field">
              <label className="field__label">Capítulo <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
              <select className="select" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
                <option value="">Todos os capítulos</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field__label">Dificuldade <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
              <select className="select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ width: 180 }}>
                <option value="">Qualquer dificuldade</option>
                <option value="1">Fácil</option>
                <option value="2">Médio</option>
                <option value="3">Difícil</option>
              </select>
            </div>

            <div style={{ paddingTop: 8 }}>
              <button
                className="btn btn--primary btn--lg"
                onClick={handleStart}
                disabled={loading}
              >
                {loading ? 'Carregando…' : 'Iniciar quiz'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Quiz phase ────────────────────────────────────────────────────────────────

function QuizPhase({ questions, onFinish, onAbort }) {
  const [counter, setCounter]       = useState(0);
  const [selected, setSelected]     = useState(null);
  const [vfAnswers, setVfAnswers]   = useState({});
  const [openText, setOpenText]     = useState('');
  const [responses, setResponses]   = useState([]);

  const current  = questions[counter];
  const total    = questions.length;
  const progress = ((counter) / total) * 100;
  const qt       = current.question_type ?? 'multiple_choice';

  const canConfirm =
    qt === 'open_answer'   ? openText.trim().length > 0 :
    qt === 'true_false'    ? Object.keys(vfAnswers).length >= current.alternatives.length :
    selected !== null;

  const handleConfirm = () => {
    if (!canConfirm) return;

    let message = 'incorrect';
    let displayAnswer = selected ?? '';

    if (qt === 'open_answer') {
      message = 'correct';
      displayAnswer = openText;
    } else if (qt === 'true_false') {
      const allCorrect = current.alternatives.every(
        (alt) => (vfAnswers[alt.letter] === 'V') === alt.is_correct,
      );
      message = allCorrect ? 'correct' : 'incorrect';
      displayAnswer = JSON.stringify(vfAnswers);
    } else {
      message = selected === current.correct_answer ? 'correct' : 'incorrect';
    }

    const result = {
      message,
      userAnswer: displayAnswer,
      id: current.id,
      issue: current.issue,
      correct_answer: current.correct_answer ?? '',
      solution: current.solution ?? null,
      alternatives: current.alternatives,
      question_type: qt,
    };

    const newResponses = [...responses, result];
    setResponses(newResponses);
    setSelected(null);
    setVfAnswers({});
    setOpenText('');

    if (counter + 1 >= total) {
      onFinish(newResponses);
    } else {
      setCounter(counter + 1);
    }
  };

  const altClass = (letter) =>
    selected === letter ? 'alt alt--selected' : 'alt';

  return (
    <>
      <Topbar crumbs={[...CRUMBS, { label: `Questão ${counter + 1}/${total}` }]} />
      <div className="content content--narrow">

        {/* Progress */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            <span>Questão {counter + 1} de {total}</span>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={onAbort}
            >
              <ArrowLeft size={14} /> Sair
            </button>
          </div>
          <div className="progress__bar" style={{ width: '100%', height: 8 }}>
            <div className="progress__fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="card">
          {/* Tags */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {current.difficulty && (
              <span className={`chip ${DIFFICULTY_CHIP[current.difficulty] ?? 'chip--neutral'}`}>
                {DIFFICULTY_LABEL[current.difficulty]}
              </span>
            )}
            {current.chapter_name  && <span className="chip chip--neutral">{current.chapter_name}</span>}
            {current.topic_name    && <span className="chip chip--neutral">{current.topic_name}</span>}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-subtle)' }}>#{current.id}</span>
          </div>

          {/* Question text */}
          <QuestionText text={current.issue} style={{ fontSize: 17, lineHeight: 1.7, margin: '0 0 28px' }} />

          {/* Alternatives */}
          {qt === 'open_answer' && (
            <textarea
              className="textarea"
              rows={4}
              placeholder="Digite sua resposta…"
              value={openText}
              onChange={(e) => setOpenText(e.target.value)}
            />
          )}

          {qt === 'true_false' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {current.alternatives.map((alt) => (
                <div key={alt.letter} style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)', padding: '12px 16px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: 15 }}><strong>{alt.letter})</strong> {alt.text}</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={`btn ${vfAnswers[alt.letter] === 'V' ? 'btn--success' : 'btn--secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => setVfAnswers((p) => ({ ...p, [alt.letter]: 'V' }))}
                    >
                      Verdadeiro
                    </button>
                    <button
                      className={`btn ${vfAnswers[alt.letter] === 'F' ? 'btn--danger' : 'btn--secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => setVfAnswers((p) => ({ ...p, [alt.letter]: 'F' }))}
                    >
                      Falso
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {qt === 'multiple_choice' && (
            <div className="alt-list" role="radiogroup">
              {current.alternatives.map(({ letter, text }) => (
                <div
                  key={letter}
                  className={altClass(letter)}
                  onClick={() => setSelected(letter)}
                  role="radio"
                  aria-checked={selected === letter}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelected(letter)}
                >
                  <div className="alt__letter">{letter}</div>
                  <QuestionText className="alt__text" text={text} />
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn--primary btn--lg"
              disabled={!canConfirm}
              onClick={handleConfirm}
            >
              {counter + 1 >= total ? 'Ver resultado' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Result phase ──────────────────────────────────────────────────────────────

function ResultPhase({ responses, onRestart, onNew }) {
  const total   = responses.length;
  const correct = responses.filter((r) => r.message === 'correct').length;
  const pct     = total ? Math.round((correct / total) * 100) : 0;

  const altResultClass = (letter, userAnswer, correctAnswer, submitted) => {
    if (!submitted) return 'alt';
    if (letter === correctAnswer) return 'alt alt--correct';
    if (letter === userAnswer)   return 'alt alt--wrong';
    return 'alt';
  };

  return (
    <>
      <Topbar crumbs={[...CRUMBS, { label: 'Resultado' }]} />
      <div className="content content--narrow">

        {/* Score card */}
        <div className="card" style={{ textAlign: 'center', padding: '40px 32px', marginBottom: 24 }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%', margin: '0 auto 20px',
            background: pct >= 70 ? 'var(--success-50)' : pct >= 40 ? 'var(--brand-50)' : 'var(--danger-50)',
            display: 'grid', placeItems: 'center',
            border: `3px solid ${pct >= 70 ? 'var(--success-500)' : pct >= 40 ? 'var(--brand-500)' : 'var(--danger-500)'}`,
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              color: pct >= 70 ? 'var(--success-600)' : pct >= 40 ? 'var(--brand-600)' : 'var(--danger-600)',
            }}>
              {pct}%
            </span>
          </div>
          <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 26 }}>
            {pct >= 70 ? 'Ótimo trabalho!' : pct >= 40 ? 'Continue praticando!' : 'Não desista!'}
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 28px' }}>
            {correct} de {total} {total === 1 ? 'questão correta' : 'questões corretas'}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn--secondary" onClick={onRestart} style={{ gap: 8 }}>
              <RotateCcw size={15} /> Refazer com as mesmas questões
            </button>
            <button className="btn btn--primary" onClick={onNew}>
              Novo quiz
            </button>
          </div>
        </div>

        {/* Review */}
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 20, margin: '0 0 16px' }}>
          Revisão
        </h3>
        {responses.map((res, idx) => {
          const isOpen = res.question_type === 'open_answer';
          const isTF   = res.question_type === 'true_false';
          const isOk   = res.message === 'correct';

          return (
            <div key={res.id} className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                  background: isOk ? 'var(--success-50)' : 'var(--danger-50)',
                  display: 'grid', placeItems: 'center',
                }}>
                  {isOk
                    ? <Check size={16} style={{ color: 'var(--success-600)' }} />
                    : <X     size={16} style={{ color: 'var(--danger-600)'  }} />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13, color: 'var(--text-muted)' }}>
                    Questão {idx + 1} · #{res.id}
                  </p>
                  <QuestionText text={res.issue} style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }} />
                </div>
              </div>

              {isOpen && (
                <div style={{ fontSize: 14, color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
                  <strong>Sua resposta:</strong> {res.userAnswer}
                </div>
              )}

              {isTF && (() => {
                let parsed = {};
                try { parsed = JSON.parse(res.userAnswer); } catch { parsed = {}; }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {res.alternatives?.map((alt) => {
                      const userVF    = parsed[alt.letter];
                      const correctVF = alt.is_correct ? 'V' : 'F';
                      const ok        = userVF === correctVF;
                      return (
                        <div key={alt.letter} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, padding: '6px 10px', borderRadius: 'var(--radius-md)', background: ok ? 'var(--success-50)' : 'var(--danger-50)' }}>
                          {ok ? <Check size={14} style={{ color: 'var(--success-600)' }} /> : <X size={14} style={{ color: 'var(--danger-600)' }} />}
                          <span><strong>{alt.letter})</strong> {alt.text}</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 700, color: ok ? 'var(--success-600)' : 'var(--danger-600)' }}>
                            {correctVF === 'V' ? 'Verdadeiro' : 'Falso'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {!isOpen && !isTF && (
                <div className="alt-list" style={{ marginTop: 4 }}>
                  {res.alternatives?.map(({ letter, text }) => (
                    <div key={letter} className={altResultClass(letter, res.userAnswer, res.correct_answer, true)}>
                      <div className="alt__letter">{letter}</div>
                      <QuestionText className="alt__text" text={text} />
                      {letter === res.correct_answer && <Check size={18} style={{ color: 'var(--success-600)', flexShrink: 0 }} />}
                      {letter === res.userAnswer && letter !== res.correct_answer && <X size={18} style={{ color: 'var(--danger-600)', flexShrink: 0 }} />}
                    </div>
                  ))}
                </div>
              )}

              {res.solution && (
                <div style={{ marginTop: 14, padding: '12px 16px', background: 'var(--brand-50)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--brand-400)' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--brand-600)', marginBottom: 4 }}>Resolução</p>
                  <QuestionText text={res.solution} style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function QuizPage() {
  const navigate = useNavigate();
  const [phase, setPhase]         = useState('filter'); // filter | quiz | result
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState([]);

  const handleStart  = (qs)  => { setQuestions(qs); setPhase('quiz'); };
  const handleFinish = (res) => { setResponses(res); setPhase('result'); };
  const handleRestart = ()   => { setResponses([]); setPhase('quiz'); };
  const handleNew    = ()    => { setQuestions([]); setResponses([]); setPhase('filter'); };
  const handleAbort  = ()    => navigate(-1);

  if (phase === 'quiz') return (
    <QuizPhase questions={questions} onFinish={handleFinish} onAbort={handleAbort} />
  );
  if (phase === 'result') return (
    <ResultPhase responses={responses} onRestart={handleRestart} onNew={handleNew} />
  );
  return <FilterPhase onStart={handleStart} />;
}
