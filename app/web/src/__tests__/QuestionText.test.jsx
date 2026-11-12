import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import QuestionText from '../components/QuestionText.jsx';

describe('Imported question content', () => {
  it('renders images, tables and formulas from the question bank', () => {
    const { container } = render(<QuestionText text={'![Gráfico](/alt-home/aplicativos/staticlass/app/api/questions/uploads/propet/image1.png)\n\n| Valor | Frequência |\n|---|---|\n| 1 | 10 |\n\n$x^2$'} />);
    expect(screen.getByRole('img', { name: 'Gráfico' })).toHaveAttribute('src', '/alt-home/aplicativos/staticlass/app/api/questions/uploads/propet/image1.png');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(container.querySelector('.katex')).not.toBeNull();
  });

  it('escapes raw HTML and blocks executable links', () => {
    const { container } = render(<QuestionText text={'<img src=x onerror="alert(1)">\n\n[Link](javascript:alert%281%29)'} />);
    expect(container.querySelector('[onerror]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Link' })).toHaveAttribute('href', '#');
  });
});
