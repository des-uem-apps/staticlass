import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, FolderOpen, X } from 'lucide-react';
import api from '../services/api.js';
import { appUrl } from '../utils/paths.js';
import QuestionText from './QuestionText.jsx';

const externalUrl = value => /^https?:\/\//i.test(value || '') ? value : undefined;

export default function ClassroomListsPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('');
  const [kind, setKind] = useState('lista');
  const [detail, setDetail] = useState(null);
  const [opening, setOpening] = useState(null);
  const [viewer, setViewer] = useState(null);

  useEffect(() => {
    let active = true;
    api.get('/lists/classroom').then(r => { if (active) setItems(r.data); })
      .catch(() => { if (active) setError('Não foi possível carregar as listas do Classroom.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!viewer) return undefined;
    const close = event => { if (event.key === 'Escape') setViewer(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [viewer]);

  const courses = useMemo(() => [...new Map(items.map(item => [item.course_id, { id: item.course_id, name: item.course_name }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [items]);
  const filtered = items.filter(item => (!course || item.course_id === course) && (!kind || item.kind === kind) &&
    `${item.title} ${item.course_name}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const groups = courses.map(c => ({ ...c, items: filtered.filter(item => item.course_id === c.id) })).filter(c => c.items.length);

  async function openDetail(id) {
    if (detail?.id === id) { setDetail(null); return; }
    setOpening(id); setError('');
    try { const result = await api.get(`/lists/classroom/${id}`); setDetail(result.data); }
    catch { setError('Não foi possível abrir esta lista. Tente novamente.'); }
    finally { setOpening(null); }
  }
  async function openFile(file) {
    setOpening(file.id); setError('');
    try {
      const result = await api.post(`/lists/classroom/${detail.id}/files/${file.id}/access`);
      setViewer({ ...result.data, url: appUrl(`/api${result.data.url}`) });
    } catch { setError('Não foi possível abrir o arquivo. Tente novamente.'); }
    finally { setOpening(null); }
  }

  if (!loading && !items.length && !error) return null;
  return (
    <section className="classroom-library" aria-label="Listas do Classroom">
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Listas do Classroom</h1>
          <p className="page-header__subtitle">Listas e materiais organizados por disciplina, com os arquivos originais.</p>
        </div>
        {!loading && <span className="chip chip--neutral">{items.filter(i => i.kind === 'lista').length} listas · {courses.length} disciplinas</span>}
      </div>
      {error && <p className="field__error" role="alert">{error}</p>}
      {loading ? <p role="status">Carregando listas do Classroom…</p> : <>
        <div className="classroom-filters">
          <input className="input" aria-label="Buscar listas do Classroom" placeholder="Buscar lista ou disciplina…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="select" aria-label="Disciplina" value={course} onChange={e => setCourse(e.target.value)}>
            <option value="">Todas as disciplinas</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select" aria-label="Tipo de material" value={kind} onChange={e => setKind(e.target.value)}>
            <option value="lista">Listas e atividades</option>
            <option value="material">Outros materiais</option>
            <option value="">Todos os materiais</option>
          </select>
        </div>
        <p className="classroom-count">{filtered.length} {filtered.length === 1 ? 'item encontrado' : 'itens encontrados'}</p>
        {!filtered.length && <p className="empty-state">Nenhum material corresponde à busca.</p>}
        {groups.map(group => <div key={group.id} className="classroom-course">
          <h2><FolderOpen size={18} aria-hidden="true" /> {group.name}</h2>
          <div className="classroom-grid">{group.items.map(item => <article key={item.id} className="card classroom-card">
            <div className="classroom-card-labels">
              <span className="chip chip--neutral">{item.kind === 'lista' ? 'Lista / atividade' : 'Material'}</span>
              {item.course_state === 'ARCHIVED' && <span className="chip chip--neutral">Turma arquivada</span>}
            </div>
            <h3>{item.title}</h3>
            <p className="classroom-count">{item.downloaded_count} de {item.attachment_count} arquivos disponíveis no Staticlass</p>
            <button className="btn btn--secondary" onClick={() => openDetail(item.id)} disabled={opening === item.id} aria-expanded={detail?.id === item.id}>
              <FileText size={15} /> {detail?.id === item.id ? 'Fechar lista' : opening === item.id ? 'Abrindo…' : 'Abrir lista'}
            </button>
            {detail?.id === item.id && <div className="classroom-detail">
              {detail.description && <QuestionText text={detail.description} />}
              {!!detail.attachments.length && <ul className="classroom-files">{detail.attachments.map(file => <li key={file.id}>
                <span>{file.name}</span>
                {file.available ? <button className="btn btn--ghost" onClick={() => openFile(file)} disabled={opening === file.id}>
                  {opening === file.id ? 'Abrindo…' : 'Abrir arquivo'}
                </button> : externalUrl(file.source_url) ? <a className="btn btn--ghost" href={externalUrl(file.source_url)} target="_blank" rel="noopener noreferrer">Abrir no Google <ExternalLink size={13} /></a> : <small>Arquivo não disponível para download</small>}
              </li>)}</ul>}
              {externalUrl(detail.source_url) && <a className="classroom-origin" href={externalUrl(detail.source_url)} target="_blank" rel="noopener noreferrer">Ver atividade no Classroom <ExternalLink size={13} /></a>}
            </div>}
          </article>)}</div>
        </div>)}
      </>}
      {viewer && <div className="classroom-viewer-backdrop" role="dialog" aria-modal="true" aria-label={viewer.name}>
        <div className="classroom-viewer">
          <div className="classroom-viewer-header"><strong>{viewer.name}</strong>
            <a className="btn btn--secondary" href={`${viewer.url}&download=1`}><Download size={15} /> Baixar</a>
            <button className="icon-btn" aria-label="Fechar arquivo" onClick={() => setViewer(null)}><X size={20} /></button>
          </div>
          {viewer.mime_type === 'application/pdf' ? <iframe title={viewer.name} src={viewer.url} /> : viewer.mime_type?.startsWith('image/') ? <img src={viewer.url} alt={viewer.name} /> :
            <div className="empty-state"><FileText size={40} /><p>Baixe o arquivo para abrir no aplicativo correspondente.</p></div>}
        </div>
      </div>}
    </section>
  );
}
