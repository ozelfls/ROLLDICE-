export const DICE = Object.freeze({
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
  dpercent: 9,
});

export const MAX_QUANTITY = Object.freeze({
  d4: 12,
  d6: 12,
  d8: 12,
  d10: 4,
  d12: 4,
  d20: 1,
  d100: 1,
  dpercent: 1,
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
  const maximum = MAX_QUANTITY[dice];
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > maximum) {
    const label = dice === 'dpercent' ? 'D%' : dice.toUpperCase();
    throw new RangeError(`A quantidade de ${label} deve estar entre 1 e ${maximum}.`);
  }
  if (!Number.isInteger(modifier) || modifier < -100 || modifier > 100) {
    throw new RangeError('O modificador deve estar entre -100 e 100.');
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
    if (mode === 'normal') return { first, second: null, rolls: [first], selected: first, selectedIndex: 0, text: `${first}${suffix}` };
    const second = randomFace(DICE[dice], random) * (percent ? 10 : 1);
    const selectedIndex = mode === 'vantagem' ? Number(second > first) : Number(second < first);
    const selected = selectedIndex === 0 ? first : second;
    return { first, second, rolls: [first, second], selected, selectedIndex, text: `${first}${suffix}/${second}${suffix}→${selected}${suffix}` };
  });

  const critical = dice === 'd20' && quantity === 1
    ? results[0].selected === 20 ? 'success' : results[0].selected === 1 ? 'failure' : null
    : null;
  const criticalText = critical === 'success' ? ' - 🗿 SUCESSO CRÍTICO!'
    : critical === 'failure' ? ' - 💀 FALHA CRÍTICA!' : '';
  const subtotal = results.reduce((sum, result) => sum + result.selected, 0);
  const total = subtotal + modifier;
  const label = percent ? 'D%' : dice.toUpperCase();
  const rollLabel = quantity === 1 ? label : `${quantity}${label}`;
  const individual = results.map((result) => result.text).join(' + ');
  const display = `${rollLabel}: ${individual} | Subtotal: ${subtotal}${suffix} | Modificador: ${modifier >= 0 ? '+' : ''}${modifier} | Total: ${total}${suffix}${criticalText}`;

  return {
    dice,
    quantity,
    modifier,
    mode,
    results,
    subtotal,
    total,
    individual,
    critical,
    display,
  };
}

export function rerollDice(previous, random = Math.random) {
  if (!previous) throw new Error('Faça uma rolagem antes de rerrolar.');
  const result = rollDice({ ...previous, mode: 'desvantagem' }, random);
  return { ...result, display: `Rerol (Desvantagem) · ${result.display}` };
}
