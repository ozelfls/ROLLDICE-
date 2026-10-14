export const DICE = Object.freeze({
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
  dpercent: 10,
});

export const MODES = Object.freeze(['normal', 'vantagem', 'desvantagem']);

function randomFace(sides, random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('A fonte aleatória deve retornar um número entre 0 e 1.');
  }
  return Math.floor(value * sides) + 1;
}

export function validateOptions({ dice, quantity, modifier, mode }) {
  if (!Object.hasOwn(DICE, dice)) throw new RangeError('Tipo de dado inválido.');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 8) {
    throw new RangeError('A quantidade deve estar entre 1 e 8.');
  }
  if (!Number.isInteger(modifier) || modifier < -10 || modifier > 10) {
    throw new RangeError('O modificador deve estar entre -10 e 10.');
  }
  if (!MODES.includes(mode)) throw new RangeError('Modo de rolagem inválido.');
}

export function rollDice(options, random = Math.random) {
  validateOptions(options);
  const { dice, quantity, modifier, mode } = options;
  const percent = dice === 'dpercent';
  const suffix = percent ? '%' : '';
  const results = Array.from({ length: quantity }, () => {
    const first = randomFace(DICE[dice], random) * (percent ? 10 : 1);
    if (mode === 'normal') return { first, selected: first, text: `${first}${suffix}` };
    const second = randomFace(DICE[dice], random) * (percent ? 10 : 1);
    const selected = mode === 'vantagem' ? Math.max(first, second) : Math.min(first, second);
    return { first, second, selected, text: `${first}${suffix}/${second}${suffix}→${selected}${suffix}` };
  });

  const critical = dice === 'd20' && quantity === 1
    ? results[0].selected === 20 ? 'success' : results[0].selected === 1 ? 'failure' : null
    : null;
  const criticalText = critical === 'success' ? ' - 🗿 SUCESSO CRÍTICO!'
    : critical === 'failure' ? ' - 💀 FALHA CRÍTICA!' : '';
  const rollText = results.map((result) => result.text).join(', ');
  let summary;

  if (dice === 'd6' && quantity > 1) {
    const total = results.reduce((sum, result) => sum + result.selected, 0);
    summary = modifier === 0
      ? `Resultado: ${rollText} = ${total}`
      : `Resultado: ${rollText} = ${total} + ${modifier} = ${total + modifier}`;
  } else if (modifier !== 0) {
    const modified = results.map((result) => `${result.selected + modifier}${suffix}`).join(', ');
    summary = `Resultados: ${rollText} ${modifier > 0 ? '+' : ''}${modifier}${suffix} = ${modified}`;
  } else {
    summary = `Resultados: ${rollText}`;
  }

  return {
    dice,
    quantity,
    modifier,
    mode,
    results,
    critical,
    display: `${summary}${criticalText}`,
  };
}

export function rerollDice(previous, random = Math.random) {
  if (!previous) throw new Error('Faça uma rolagem antes de rerrolar.');
  const result = rollDice({ ...previous, mode: 'desvantagem' }, random);
  return { ...result, display: result.display.replace(/^Resultados?:/, 'Rerol (Desvantagem):') };
}
