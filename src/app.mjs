import { DICE, MAX_QUANTITY, rollDice, rerollDice } from './engine.mjs';
import { DiceView } from './dice-view.mjs';

const diceGrid = document.querySelector('#dice-grid');
const modeGrid = document.querySelector('#mode-grid');
const quantityInput = document.querySelector('#quantity');
const quantityHelp = document.querySelector('#quantity-help');
const quantityMinus = document.querySelector('#quantity-minus');
const quantityPlus = document.querySelector('#quantity-plus');
const modifierInput = document.querySelector('#modifier');
const resultValue = document.querySelector('#result-value');
const resultMeta = document.querySelector('#result-meta');
const rollBadge = document.querySelector('#roll-badge');
const formError = document.querySelector('#form-error');
const rerollButton = document.querySelector('#reroll-button');
const clearHistoryButton = document.querySelector('#clear-history-button');
const historyList = document.querySelector('#history-list');
const historyEmpty = document.querySelector('#history-empty');
const historyCount = document.querySelector('#history-count');
const themeButton = document.querySelector('#theme-button');
const rollButton = document.querySelector('#roll-form button[type="submit"]');
const view = new DiceView(document.querySelector('#dice-stage'), document.querySelector('#dice-labels'));

const state = {
  dice: 'd20',
  mode: 'normal',
  previous: null,
  history: [],
  light: false,
  rolling: false,
  previewPending: false,
};

const modes = [
  { value: 'normal', label: 'Normal', help: 'Um lançamento por dado.' },
  { value: 'vantagem', label: 'Vantagem', help: 'Rola duas vezes e usa o maior resultado.' },
  { value: 'desvantagem', label: 'Desvantagem', help: 'Rola duas vezes e usa o menor resultado.' },
];

function createChoice(value, label, selected, group, onSelect) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'choice-button';
  button.textContent = label;
  button.dataset.value = value;
  button.setAttribute('role', 'radio');
  button.setAttribute('aria-checked', String(selected));
  button.tabIndex = selected ? 0 : -1;
  button.addEventListener('click', () => onSelect(value));
  button.addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...group.querySelectorAll('[role="radio"]')];
    const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
    const next = buttons[(buttons.indexOf(button) + direction + buttons.length) % buttons.length];
    onSelect(next.dataset.value);
    next.focus();
  });
  return button;
}

function updateSelection(container, selected) {
  for (const button of container.querySelectorAll('[role="radio"]')) {
    const active = button.dataset.value === selected;
    button.setAttribute('aria-checked', String(active));
    button.tabIndex = active ? 0 : -1;
  }
}

function selectDice(dice) {
  state.dice = dice;
  updateSelection(diceGrid, dice);
  const maximum = MAX_QUANTITY[dice];
  quantityInput.max = String(maximum);
  const current = Number(quantityInput.value);
  if (quantityInput.value.trim() === '' || !Number.isInteger(current) || current < 1) {
    quantityInput.value = '1';
  } else if (current > maximum) {
    quantityInput.value = String(maximum);
  }
  quantityInput.readOnly = maximum === 1;
  quantityMinus.disabled = maximum === 1;
  quantityPlus.disabled = maximum === 1;
  quantityHelp.textContent = maximum === 1 ? '1 dado por jogada' : `De 1 a ${maximum} dados`;
  hideError();
  if (state.rolling) state.previewPending = true;
  else preview();
}

function selectMode(mode) {
  state.mode = mode;
  updateSelection(modeGrid, mode);
  document.querySelector('#mode-description').textContent = modes.find((item) => item.value === mode).help;
  if (state.rolling) state.previewPending = true;
  else preview();
}

function preview() {
  const quantity = Math.min(MAX_QUANTITY[state.dice], Math.max(1, Number(quantityInput.value) || 1));
  view.show(state.dice, quantity, state.mode);
}

diceGrid.setAttribute('role', 'radiogroup');
diceGrid.setAttribute('aria-label', 'Tipo de dado');
for (const dice of Object.keys(DICE)) {
  diceGrid.append(createChoice(dice, dice === 'dpercent' ? 'D%' : dice.toUpperCase(), dice === state.dice, diceGrid, selectDice));
}
selectDice(state.dice);

modeGrid.setAttribute('role', 'radiogroup');
modeGrid.setAttribute('aria-label', 'Modo de rolagem');
for (const mode of modes) {
  modeGrid.append(createChoice(mode.value, mode.label, mode.value === state.mode, modeGrid, selectMode));
}

function adjustInput(input, delta) {
  const min = Number(input.min);
  const max = Number(input.max);
  const current = input.value.trim() === '' ? Number(input.defaultValue) : Number(input.value);
  input.value = String(Math.min(max, Math.max(min, (Number.isFinite(current) ? current : min) + delta)));
  hideError();
}

quantityMinus.addEventListener('click', () => { adjustInput(quantityInput, -1); if (state.rolling) state.previewPending = true; else preview(); });
quantityPlus.addEventListener('click', () => { adjustInput(quantityInput, 1); if (state.rolling) state.previewPending = true; else preview(); });
quantityInput.addEventListener('input', () => { if (state.rolling) state.previewPending = true; else preview(); });
document.querySelector('#modifier-minus').addEventListener('click', () => adjustInput(modifierInput, -1));
document.querySelector('#modifier-plus').addEventListener('click', () => adjustInput(modifierInput, 1));

function hideError() {
  formError.hidden = true;
  formError.classList.add('hidden');
  formError.textContent = '';
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
  formError.classList.remove('hidden');
}

function readOptions() {
  if (quantityInput.value.trim() === '' || modifierInput.value.trim() === '') {
    throw new RangeError('Preencha a quantidade e o modificador.');
  }
  return {
    dice: state.dice,
    mode: state.mode,
    quantity: Number(quantityInput.value),
    modifier: Number(modifierInput.value),
  };
}

function formatTime(date) {
  return date.toLocaleTimeString('pt-BR', { hour12: false });
}

function renderResult(result, rerolled = false) {
  const percent = result.dice === 'dpercent' ? '%' : '';
  const label = result.dice === 'dpercent' ? 'D%' : result.dice.toUpperCase();
  resultValue.textContent = result.quantity > 4
    ? `${result.quantity}${label} · Total: ${result.total}${percent}`
    : `${result.quantity > 1 ? result.quantity : ''}${label}: ${result.individual} · Total: ${result.total}${percent}`;
  resultValue.dataset.critical = result.critical || '';
  rollBadge.textContent = result.critical === 'success' ? 'SUCESSO CRÍTICO'
    : result.critical === 'failure' ? 'FALHA CRÍTICA'
    : rerolled ? 'RERROLAGEM' : 'ROLAGEM';
  resultMeta.textContent = `${result.quantity > 4 ? `Dados: ${result.results.map((item) => item.selected).join(' + ')} · ` : ''}Subtotal: ${result.subtotal}${percent} · Modificador: ${result.modifier >= 0 ? '+' : ''}${result.modifier} · ${result.mode}${rerolled ? ' · rerrolagem' : ''}`;
}

function renderHistory() {
  historyList.replaceChildren();
  const count = state.history.length;
  historyCount.textContent = count === 0 ? 'Nenhuma rolagem ainda' : `${count} ${count === 1 ? 'rolagem registrada' : 'rolagens registradas'}`;
  historyEmpty.classList.toggle('hidden', count > 0);
  clearHistoryButton.disabled = count === 0;

  for (const entry of [...state.history].reverse()) {
    const item = document.createElement('li');
    item.className = 'history-item';
    const time = document.createElement('time');
    time.className = 'shrink-0 text-xs font-bold text-[var(--muted)]';
    time.textContent = entry.time;
    const display = document.createElement('span');
    display.className = 'min-w-0 break-words text-sm font-semibold';
    display.textContent = entry.display;
    item.append(time, display);
    historyList.append(item);
  }
}

function record(result, rerolled = false) {
  const time = formatTime(new Date());
  state.history.push({ time, display: result.display });
  renderResult(result, rerolled);
  renderHistory();
}

async function play(result, rerolled = false) {
  state.rolling = true;
  rollButton.disabled = true;
  rerollButton.disabled = true;
  rollBadge.textContent = 'ROLANDO...';
  resultValue.textContent = 'Os dados estão rolando...';
  resultMeta.textContent = `${result.dice === 'dpercent' ? 'D%' : result.dice.toUpperCase()} · lançamento em andamento`;
  try {
    const completed = await view.animate(result.dice, result);
    if (completed) record(result, rerolled);
  } finally {
    state.rolling = false;
    rollButton.disabled = false;
    rerollButton.disabled = !state.previous;
    if (state.previewPending) preview();
    state.previewPending = false;
  }
}

document.querySelector('#roll-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.rolling) return;
  hideError();
  try {
    const result = rollDice(readOptions());
    state.previous = {
      dice: result.dice,
      quantity: result.quantity,
      modifier: result.modifier,
      mode: result.mode,
    };
    await play(result);
  } catch (error) {
    showError(error.message);
  }
});

rerollButton.addEventListener('click', async () => {
  if (!state.previous || state.rolling) return;
  hideError();
  try {
    const result = rerollDice(state.previous);
    await play(result, true);
  } catch (error) {
    showError(error.message);
  }
});

document.querySelector('#reset-button').addEventListener('click', () => {
  if (state.rolling) view.clear();
  resultValue.textContent = 'Selecione um dado e clique em Rolar!';
  resultValue.dataset.critical = '';
  resultMeta.textContent = 'Escolha seu dado, modo e modificador abaixo.';
  rollBadge.textContent = 'PRONTO PARA ROLAR';
  state.previous = null;
  rerollButton.disabled = true;
  hideError();
  preview();
});

clearHistoryButton.addEventListener('click', () => {
  state.history = [];
  renderHistory();
});

themeButton.addEventListener('click', () => {
  state.light = !state.light;
  document.documentElement.dataset.theme = state.light ? 'light' : 'dark';
  themeButton.textContent = state.light ? '🌙 Tema escuro' : '☀️ Tema claro';
});

renderHistory();
