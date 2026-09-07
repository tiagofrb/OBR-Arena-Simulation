/**
 * Detecta se o foco está em campo editável — atalhos globais não devem
 * roubar a tecla (issue #1: teclas 1–6 em inputs).
 *
 * @param {EventTarget|null|undefined} el
 * @returns {boolean}
 */
export function isTypingTarget(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  // Qualquer controle de formulário impede atalhos de aba/ferramenta
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return true;
  if (el.isContentEditable) return true;
  if (el.closest && el.closest('[contenteditable="true"]')) return true;
  // Garante cobertura mesmo se o foco estiver em label associado
  if (el.closest && el.closest('input, textarea, select, [contenteditable="true"]')) return true;
  return false;
}
