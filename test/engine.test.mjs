import test from 'node:test';
import assert from 'node:assert/strict';
import { DICE, MAX_QUANTITY, rollDice, rerollDice } from '../src/engine.mjs';

const options = { dice: 'd20', quantity: 1, modifier: 0, mode: 'normal' };
const sequence = (...values) => {
  let index = 0;
  return () => values[index++];
};

test('todos os tipos de dado alcançam os valores mínimo e máximo', () => {
  for (const [dice, sides] of Object.entries(DICE)) {
    const minimum = rollDice({ ...options, dice }, () => 0).results[0].selected;
    const maximum = rollDice({ ...options, dice }, () => 1 - Number.EPSILON).results[0].selected;
    assert.equal(minimum, dice === 'dpercent' ? 10 : 1);
    assert.equal(maximum, dice === 'dpercent' ? 100 : sides);
  }
});

test('vantagem escolhe o maior e desvantagem escolhe o menor', () => {
  const advantage = rollDice({ ...options, mode: 'vantagem' }, sequence(0, 0.95));
  const disadvantage = rollDice({ ...options, mode: 'desvantagem' }, sequence(0, 0.95));
  assert.equal(advantage.results[0].selected, 20);
  assert.equal(disadvantage.results[0].selected, 1);
  assert.equal(advantage.results[0].text, '1/20→20');
});

test('cada tipo de dado respeita seu limite próprio de quantidade', () => {
  for (const [dice, maximum] of Object.entries(MAX_QUANTITY)) {
    const allowed = rollDice({ ...options, dice, quantity: maximum }, () => 0);
    assert.equal(allowed.results.length, maximum, dice);
    assert.throws(() => rollDice({ ...options, dice, quantity: maximum + 1 }), RangeError, dice);
  }
});

test('vários D6 são somados antes de aplicar o modificador uma vez', () => {
  const result = rollDice({ dice: 'd6', quantity: 3, modifier: 2, mode: 'normal' }, sequence(0, 0.5, 0.99));
  assert.equal(result.display, 'Resultado: 1, 4, 6 = 11 + 2 = 13');
});

test('demais dados recebem o modificador individualmente', () => {
  const result = rollDice({ dice: 'd4', quantity: 2, modifier: -1, mode: 'normal' }, sequence(0, 0.99));
  assert.equal(result.display, 'Resultados: 1, 4 -1 = 0, 3');
});

test('D% mantém passos de dez e seu sufixo nos resultados', () => {
  const result = rollDice({ dice: 'dpercent', quantity: 1, modifier: 2, mode: 'vantagem' }, sequence(0, 0.99));
  assert.equal(result.display, 'Resultados: 10%/100%→100% +2% = 102%');
});

test('críticos só aparecem em um D20', () => {
  assert.equal(rollDice(options, () => 0).critical, 'failure');
  assert.equal(rollDice(options, () => 0.99).critical, 'success');
  assert.equal(rollDice({ ...options, dice: 'd6', quantity: 2 }, () => 0.99).critical, null);
});

test('rerrolagem usa a configuração anterior e sempre impõe desvantagem', () => {
  const result = rerollDice({ dice: 'd20', quantity: 1, modifier: 1, mode: 'vantagem' }, sequence(0.95, 0));
  assert.equal(result.mode, 'desvantagem');
  assert.equal(result.results[0].selected, 1);
  assert.match(result.display, /^Rerol \(Desvantagem\): 20\/1→1 \+1 = 2/);
  assert.equal(result.critical, 'failure');
});

test('modificadores nos dois limites são aceitos', () => {
  assert.equal(rollDice({ ...options, modifier: -100 }, () => 0).display, 'Resultados: 1 -100 = -99 - 💀 FALHA CRÍTICA!');
  assert.equal(rollDice({ ...options, modifier: 100 }, () => 0).display, 'Resultados: 1 +100 = 101 - 💀 FALHA CRÍTICA!');
});

test('entradas fora dos limites são rejeitadas', () => {
  for (const changed of [
    { dice: 'd7' }, { quantity: 0 }, { quantity: 2 }, { quantity: 1.5 },
    { modifier: -101 }, { modifier: 101 }, { modifier: NaN }, { mode: 'outro' },
  ]) {
    assert.throws(() => rollDice({ ...options, ...changed }), RangeError);
  }
  assert.throws(() => rerollDice(null), /antes de rerrolar/);
});
