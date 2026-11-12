import { useMemo } from 'react';
import { Marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const escapeHtml = (value = '') => value.replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const safeUrl = (url = '') => /^(https?:\/\/|\/(?!\/))/i.test(url) ? escapeHtml(url) : '#';
const BLOCK_MATH = /(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$/g;
const INLINE_MATH = /(?<!\\)\$([^\n$]+?)(?<!\\)\$/g;
const parser = new Marked({
  breaks: true,
  renderer: {
    html({ text }) { return escapeHtml(text); },
    link({ href, tokens }) {
      return `<a href="${safeUrl(href)}" target="_blank" rel="noopener noreferrer">${this.parser.parseInline(tokens)}</a>`;
    },
    image({ href, text }) {
      return `<img src="${safeUrl(href)}" alt="${escapeHtml(text)}" loading="lazy" />`;
    },
  },
});

export default function QuestionText({ text, style, className = '' }) {
  const html = useMemo(() => {
    const math = [];
    const saveMath = (expr, displayMode) => {
      math.push(katex.renderToString(expr, { displayMode, throwOnError: false, trust: false }));
      return String.fromCharCode(0xe000) + (math.length - 1) + String.fromCharCode(0xe001);
    };
    const source = (text || '')
      .replace(BLOCK_MATH, (_, expr) => saveMath(expr, true))
      .replace(INLINE_MATH, (_, expr) => saveMath(expr, false));
    return parser.parse(source).replace(/\uE000(\d+)\uE001/g, (_, index) => math[Number(index)] || '');
  }, [text]);
  return <div className={`question-content ${className}`} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
