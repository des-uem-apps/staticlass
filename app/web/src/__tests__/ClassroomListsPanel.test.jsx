import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi } from 'vitest';
import ClassroomListsPanel from '../components/ClassroomListsPanel.jsx';
import api from '../services/api.js';

afterEach(() => vi.restoreAllMocks());

const items = [
  { id: 1, title: 'Lista 1', kind: 'lista', course_id: 'c1', course_name: 'Inferência II', attachment_count: 1, downloaded_count: 1 },
  { id: 2, title: 'Lista 2', kind: 'lista', course_id: 'c2', course_name: 'Séries Temporais', attachment_count: 1, downloaded_count: 1 },
  { id: 3, title: 'Notas de aula', kind: 'material', course_id: 'c1', course_name: 'Inferência II', attachment_count: 1, downloaded_count: 1 },
];

describe('Classroom list library', () => {
  it('organizes lists by discipline and filters other materials', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: items });
    const user = userEvent.setup(); render(<ClassroomListsPanel />);
    await screen.findByRole('heading', { name: 'Lista 1' });
    expect(screen.queryByRole('heading', { name: 'Notas de aula' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Disciplina'), 'c2');
    expect(screen.queryByRole('heading', { name: 'Lista 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lista 2' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Disciplina'), '');
    await user.selectOptions(screen.getByLabelText('Tipo de material'), 'material');
    expect(screen.getByRole('heading', { name: 'Notas de aula' })).toBeInTheDocument();
  });

  it('opens an authorized PDF in the application and retains its source', async () => {
    vi.spyOn(api, 'get').mockImplementation(url => Promise.resolve({ data: url === '/lists/classroom' ? [items[0]] : {
      ...items[0], description: 'Exercícios da disciplina.', source_url: 'https://classroom.google.com/c/123',
      attachments: [{ id: 'file1', name: 'Lista 1.pdf', available: true }],
    } }));
    const access = vi.spyOn(api, 'post').mockResolvedValue({ data: { name: 'Lista 1.pdf', mime_type: 'application/pdf', url: '/lists/classroom/1/files/file1?ticket=example' } });
    const user = userEvent.setup(); render(<ClassroomListsPanel />);
    await user.click(await screen.findByRole('button', { name: 'Abrir lista' }));
    expect(await screen.findByText('Exercícios da disciplina.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver atividade no Classroom/ })).toHaveAttribute('href', 'https://classroom.google.com/c/123');
    await user.click(screen.getByRole('button', { name: 'Abrir arquivo' }));
    await waitFor(() => expect(access).toHaveBeenCalledWith('/lists/classroom/1/files/file1/access'));
    expect(await screen.findByTitle('Lista 1.pdf')).toHaveAttribute('src', expect.stringContaining('/api/lists/classroom/1/files/file1?ticket=example'));
    await user.click(screen.getByRole('button', { name: 'Fechar arquivo' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
