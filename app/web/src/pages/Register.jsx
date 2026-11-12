import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { appUrl } from '../utils/paths.js';

export default function Register() {
  const navigate = useNavigate();
  const { markEmailVerified } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUem, setIsUem] = useState(false);
  const [ra, setRa] = useState('');
  const [nivelCurso, setNivelCurso] = useState('graduacao');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState('form'); // 'form' | 'verify' | 'success'
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [resending, setResending] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', {
        name,
        email,
        password,
        confirm_password: confirmPassword,
        is_uem: isUem,
        ra: isUem ? ra : undefined,
        nivel_curso: isUem ? nivelCurso : undefined,
      });
      setDeliveryMessage('Código enviado. Confira sua caixa de entrada e o spam.');
      setStep('verify');
    } catch (err) {
      if (err.response?.data?.verification_pending) {
        setStep('verify');
        setOtpError(err.response.data.error);
        return;
      }
      setError(err.response?.data?.error || 'Erro ao cadastrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setOtpError('');
    setOtpLoading(true);
    try {
      await api.post('/auth/verify-code', { email, code: otpCode });
      markEmailVerified();
      setStep('success');
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Código inválido. Tente novamente.');
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResend() {
    setOtpError('');
    setDeliveryMessage('');
    setResending(true);
    try {
      const response = await api.post('/auth/resend-verification', { email });
      setDeliveryMessage(response.data.message);
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Não foi possível reenviar o código. Tente novamente.');
    } finally {
      setResending(false);
    }
  }

  if (step === 'success') {
    return (
      <div className="login-shell">
        <div className="login-topright">
          <img src={appUrl('/logo.png')} alt="Staticlass" />
        </div>
        <div className="login-card" style={{ textAlign: 'center', gap: 16 }}>
          <div style={{ fontSize: 56, color: 'var(--green, #55bf44)' }}>✓</div>
          <h2 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Conta verificada!</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Seu email foi confirmado com sucesso.</p>
          <button className="btn btn--primary" style={{ marginTop: 8 }} onClick={() => navigate('/login', { replace: true })}>
            Ir para o login
          </button>
        </div>
        <div className="login-footer">
          <img src={appUrl('/uem-logo.png')} alt="UEM" />
          <img src={appUrl('/acao11-logo.webp')} alt="DataSci PROPET — Ação 11" />
        </div>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="login-shell">
        <div className="login-topright">
          <img src={appUrl('/logo.png')} alt="Staticlass" />
        </div>
        <div className="login-card">
          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0, marginBottom: 8 }}>Verifique seu email</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 0, marginBottom: 20, fontSize: 14 }}>
            Confirme <strong>{email}</strong> com o código de 6 dígitos.
          </p>
          {deliveryMessage && <p role="status">{deliveryMessage}</p>}
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              style={{ textAlign: 'center', letterSpacing: 12, fontSize: 22 }}
              required
            />
            {otpError && <p className="field__error">{otpError}</p>}
            <button className="btn btn--primary" disabled={otpLoading || otpCode.length < 6}>
              {otpLoading ? 'Verificando…' : 'Verificar'}
            </button>
          </form>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14 }}
            >
              {resending ? 'Reenviando…' : 'Reenviar código'}
            </button>
            <Link to="/login" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Verificar mais tarde
            </Link>
          </div>
        </div>
        <div className="login-footer">
          <img src={appUrl('/uem-logo.png')} alt="UEM" />
          <img src={appUrl('/acao11-logo.webp')} alt="DataSci PROPET — Ação 11" />
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="login-topright">
        <img src={appUrl('/logo.png')} alt="Staticlass" />
      </div>
      <div className="login-card">
        <div className="login-logo">
          <img src={appUrl('/logo.png')} alt="Staticlass" className="login-logo__img" />
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field__label" htmlFor="name">Nome</label>
            <input className="input login-input" id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field__label" htmlFor="email">Email</label>
            <input className="input login-input" id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field__label" htmlFor="password">Senha</label>
            <input className="input login-input" id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field__label" htmlFor="confirm">Confirmar senha</label>
            <input className="input login-input" id="confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={isUem}
              onChange={(e) => setIsUem(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Sou aluno da UEM
          </label>

          {isUem && (
            <div className="field" style={{ marginBottom: 0 }}>
              <fieldset style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
                <legend className="field__label">Vínculo com a UEM</legend>
                <div style={{ display: 'flex', gap: 20 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={nivelCurso === 'graduacao'} onChange={() => setNivelCurso('graduacao')} />
                    Graduação
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={nivelCurso === 'mestrado'} onChange={() => setNivelCurso('mestrado')} />
                    Mestrado
                  </label>
                </div>
              </fieldset>
              <label className="field__label" htmlFor="ra">Número do RA</label>
              <input
                className="input login-input"
                id="ra"
                type="text"
                value={ra}
                onChange={(e) => setRa(e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                pattern="[0-9]+"
                maxLength={28}
                placeholder="Ex: 135899"
                aria-describedby="ra-hint"
                required={isUem}
              />
              <small id="ra-hint">Digite apenas os números, sem RA ou PG.</small>
            </div>
          )}

          {error && <p className="field__error">{error}</p>}

          <button className="btn btn--primary login-submit" disabled={loading}>
            {loading ? 'Cadastrando…' : 'Cadastrar'}
          </button>
        </form>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
          Já tem conta?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Entrar</Link>
        </p>
      </div>

      <div className="login-footer">
        <img src={appUrl('/uem-logo.png')} alt="UEM" />
        <img src={appUrl('/acao11-logo.webp')} alt="DataSci PROPET — Ação 11" />
      </div>
    </div>
  );
}
