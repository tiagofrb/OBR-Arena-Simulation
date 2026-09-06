/**
 * Classificador genérico de ladrilhos do formato oficial OBR/RoboCup.
 * Usa paths (conectividade), gaps, seesaw e nomes de imagem especiais.
 * Não depende de tabela manual de 87+ IDs.
 */

/**
 * @param {object} tileType - objeto tileType do JSON oficial
 * @returns {{ type: string, extra?: object, note?: string }}
 */
export function classifyOfficialTile(tileType) {
  if (!tileType || typeof tileType !== 'object') {
    return { type: 'custom', note: 'tileType ausente' };
  }

  const { image, gaps, seesaw, paths } = tileType;

  // Exceções nomeadas (não seguem a regra de paths)
  if (image === 'ev1.png') return { type: 'rescue', note: 'zona de resgate — cor a confirmar' };
  if (image === 'ev2.png') return { type: 'rescue', note: 'zona de resgate — cor a confirmar' };
  if (image === 'ev3.png') return { type: 'rescue', note: 'zona de resgate — cor a confirmar' };
  if (image === 'exit.png') {
    return { type: 'rescue_exit', note: 'transição pista/resgate — confirmar entrada vs saída' };
  }
  if (image === 'seesaw.png') return { type: 'gangorra' };

  if (gaps > 0) return { type: 'gap', extra: { gaps } };
  if (seesaw === 1) return { type: 'gangorra' };

  const sides = Object.keys(paths || {});
  switch (sides.length) {
    case 0:
      return { type: 'custom', note: 'sem paths e sem imagem especial reconhecida' };
    case 1:
      return { type: 'deadend' };
    case 2: {
      const opposite =
        (sides.includes('top') && sides.includes('bottom')) ||
        (sides.includes('left') && sides.includes('right'));
      return { type: opposite ? 'straight' : 'curve90' };
    }
    case 3:
      return { type: 'intersection_t' };
    case 4:
      return { type: 'intersection' };
    default:
      return { type: 'custom', note: 'formato de paths inesperado' };
  }
}

export default classifyOfficialTile;
