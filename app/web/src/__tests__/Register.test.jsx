import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext.jsx';
import Register from '../pages/Register.jsx';
import Login from '../pages/Login.jsx';
import api from '../services/api.js';

function setup(initialPath = '/register') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => localStorage.clear());

describe('Register page', () => {
  it('renders all form fields', () => {
    setup();
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^senha$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar senha/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /sou aluno da uem/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cadastrar/i })).toBeInTheDocument();
  });

  it('RA field hidden by default, visible after checking UEM checkbox', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.queryByLabelText(/número do ra/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /sou aluno da uem/i }));
    expect(screen.getByLabelText(/número do ra/i)).toBeInTheDocument();
  });

  it('shows client-side error when passwords do not match', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(/nome/i), 'Teste');
    await user.type(screen.getByLabelText(/email/i), 'novo@test.com');
    await user.type(screen.getByLabelText(/^senha$/i), 'abc123');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'diferente');
    await user.click(screen.getByRole('button', { name: /cadastrar/i }));
    expect(await screen.findByText(/senhas não coincidem/i)).toBeInTheDocument();
  });

  it('shows API error when email is already registered', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(/nome/i), 'Teste');
    await user.type(screen.getByLabelText(/email/i), 'existing@test.com');
    await user.type(screen.getByLabelText(/^senha$/i), 'abc123');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'abc123');
    await user.click(screen.getByRole('button', { name: /cadastrar/i }));
    expect(await screen.findByText(/email já cadastrado/i)).toBeInTheDocument();
  });

  it('shows OTP step after successful registration', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(/nome/i), 'Novo Aluno');
    await user.type(screen.getByLabelText(/email/i), 'novo@test.com');
    await user.type(screen.getByLabelText(/^senha$/i), 'abc123');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'abc123');
    await user.click(screen.getByRole('button', { name: /cadastrar/i }));
    expect(await screen.findByText(/verifique seu email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
  });

  it('shows OTP error on invalid code', async () => {
    const user = userEvent.setup();
    setup();
    // Register first
    await user.type(screen.getByLabelText(/nome/i), 'Novo Aluno');
    await user.type(screen.getByLabelText(/email/i), 'novo@test.com');
    await user.type(screen.getByLabelText(/^senha$/i), 'abc123');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'abc123');
    await user.click(screen.getByRole('button', { name: /cadastrar/i }));
    await screen.findByText(/verifique seu email/i);
    // Enter wrong OTP
    await user.type(screen.getByPlaceholderText('000000'), '999999');
    await user.click(screen.getByRole('button', { name: /verificar/i }));
    expect(await screen.findByText(/código inválido/i)).toBeInTheDocument();
  });

  it('"Criar conta" link is visible on Login page', () => {
    setup('/login');
    expect(screen.getByRole('link', { name: /criar conta/i })).toBeInTheDocument();
  });
});


describe('UEM student registration', () => {
  it.each([
    ['Graduação', 'graduacao'],
    ['Mestrado', 'mestrado'],
  ])('submits numeric RA and the selected %s level', async (label, level) => {
    const user = userEvent.setup();
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
    try {
      setup();
      await user.type(screen.getByLabelText(/nome/i), 'Estudante UEM');
      await user.type(screen.getByLabelText(/email/i), 'estudante@example.com');
      await user.type(screen.getByLabelText(/^senha$/i), 'teste123');
      await user.type(screen.getByLabelText(/confirmar senha/i), 'teste123');
      await user.click(screen.getByRole('checkbox', { name: /sou aluno da uem/i }));
      await user.click(screen.getByRole('checkbox', { name: label, exact: true }));
      expect(screen.getByRole('checkbox', { name: label, exact: true })).toBeChecked();
      const other = label === 'Mestrado' ? 'Graduação' : 'Mestrado';
      expect(screen.getByRole('checkbox', { name: other, exact: true })).not.toBeChecked();
      await user.type(screen.getByLabelText(/número do ra/i), 'RA00a123-4');
      expect(screen.getByLabelText(/número do ra/i)).toHaveValue('001234');
      await user.click(screen.getByRole('button', { name: /cadastrar/i }));
      await waitFor(() => expect(post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({
        is_uem: true, ra: '001234', nivel_curso: level,
      })));
    } finally {
      post.mockRestore();
    }
  });
});
