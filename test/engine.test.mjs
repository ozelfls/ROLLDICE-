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
    assert.equal(maximum, dice === 'dpercent' ? 90 : sides);
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
  assert.equal(result.display, '3D6: 1 + 4 + 6 | Subtotal: 11 | Modificador: +2 | Total: 13');
});

test('todos os dados são somados antes do modificador', () => {
  const result = rollDice({ dice: 'd4', quantity: 2, modifier: -1, mode: 'normal' }, sequence(0, 0.99));
  assert.equal(result.display, '2D4: 1 + 4 | Subtotal: 5 | Modificador: -1 | Total: 4');
});

test('D% mantém passos de dez e seu sufixo nos resultados', () => {
  const result = rollDice({ dice: 'dpercent', quantity: 1, modifier: 2, mode: 'vantagem' }, sequence(0, 0.99));
  assert.equal(result.display, 'D%: 10%/90%→90% | Subtotal: 90% | Modificador: +2 | Total: 92%');
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
  assert.match(result.display, /^Rerol \(Desvantagem\) · D20: 20\/1→1 \| Subtotal: 1 \| Modificador: \+1 \| Total: 2/);
  assert.equal(result.critical, 'failure');
});

test('modificadores nos dois limites são aceitos', () => {
  assert.equal(rollDice({ ...options, modifier: -100 }, () => 0).display, 'D20: 1 | Subtotal: 1 | Modificador: -100 | Total: -99 - 💀 FALHA CRÍTICA!');
  assert.equal(rollDice({ ...options, modifier: 100 }, () => 0).display, 'D20: 1 | Subtotal: 1 | Modificador: +100 | Total: 101 - 💀 FALHA CRÍTICA!');
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

test('todos os dados e modos preservam seleção, quantidade e soma', () => {
  for (const [dice, maximum] of Object.entries(MAX_QUANTITY)) {
    for (const mode of ['normal', 'vantagem', 'desvantagem']) {
      for (const modifier of [-100, 0, 100]) {
        const values = Array.from({ length: maximum * (mode === 'normal' ? 1 : 2) }, (_, index) => index % 2 ? .999 : 0);
        const result = rollDice({ dice, quantity: maximum, mode, modifier }, sequence(...values));
        assert.equal(result.results.length, maximum);
        assert.equal(result.subtotal, result.results.reduce((sum, item) => sum + item.selected, 0));
        assert.equal(result.total, result.subtotal + modifier);
        for (const item of result.results) {
          assert.equal(item.rolls.length, mode === 'normal' ? 1 : 2);
          assert.equal(item.selected, item.rolls[item.selectedIndex]);
          assert.equal(item.selected, mode === 'vantagem' ? Math.max(...item.rolls) : mode === 'desvantagem' ? Math.min(...item.rolls) : item.first);
          assert.ok(item.selected >= (dice === 'dpercent' ? 10 : 1));
          assert.ok(item.selected <= (dice === 'dpercent' ? 90 : DICE[dice]));
        }
      }
    }
  }
});

test('bônus extras são aplicados em ordem e a CD avalia o total', () => {
  const result = rollDice({ ...options, modifier: 3, bonuses: [2, -1], dc: 18 }, () => .65);
  assert.equal(result.subtotal, 14);
  assert.equal(result.total, 18);
  assert.deepEqual(result.bonuses, [2, -1]);
  assert.equal(result.outcome, 'success');
  assert.match(result.display, /Bônus: \+2, -1 \| Total: 18 \| CD: 18 \| SUCESSO/);
  assert.equal(rerollDice({ ...options, modifier: 3, bonuses: [2], dc: 19 }, sequence(.9, .6)).outcome, 'failure');
});

test('críticos do D20 prevalecem sobre a CD', () => {
  assert.equal(rollDice({ ...options, modifier: 100, dc: 1 }, () => 0).outcome, 'failure');
  assert.equal(rollDice({ ...options, modifier: -100, dc: 999 }, () => .999).outcome, 'success');
  assert.equal(rollDice({ ...options, dice: 'd6', dc: 1 }, () => 0).outcome, 'success');
  assert.equal(rollDice(options, () => .5).outcome, null);
});

test('CD e bônus extras rejeitam valores inválidos', () => {
  for (const changed of [{ dc: 0 }, { dc: 1000 }, { dc: 1.5 }, { bonuses: [101] }, { bonuses: [-101] }, { bonuses: [1, 2, 3, 4, 5] }, { bonuses: '3' }]) {
    assert.throws(() => rollDice({ ...options, ...changed }), RangeError);
  }
});
