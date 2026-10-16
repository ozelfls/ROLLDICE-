import { DICE, MAX_QUANTITY, rollDice, rerollDice } from './engine.mjs';
import { DiceView } from './dice-view.mjs';
import { SKINS } from './dice-skins.mjs';

await document.fonts.load('700 24px "Cinzel Bold"');

const diceGrid = document.querySelector('#dice-grid');
const skinPicker = document.querySelector('#skin-picker');
const skinTrigger = document.querySelector('#skin-trigger');
const skinTriggerLabel = document.querySelector('#skin-trigger-label');
const skinMenu = document.querySelector('#skin-menu');
const modeGrid = document.querySelector('#mode-grid');
const quantityInput = document.querySelector('#quantity');
const quantityHelp = document.querySelector('#quantity-help');
const quantityMinus = document.querySelector('#quantity-minus');
const quantityPlus = document.querySelector('#quantity-plus');
const modifierInput = document.querySelector('#modifier');
const difficultyInput = document.querySelector('#difficulty');
const bonusesInput = document.querySelector('#bonuses');
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
  skin: 'classic',
  mode: 'normal',
  previous: null,
  history: [],
  light: false,
  rolling: false,
  previewPending: false,
  sequence: null,
};

const signed = (value) => `${value >= 0 ? '+' : ''}${value}`;

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

function closeSkinMenu(focusTrigger = false) {
  skinMenu.hidden = true;
  skinTrigger.setAttribute('aria-expanded', 'false');
  if (focusTrigger) skinTrigger.focus();
}

function openSkinMenu() {
  if (state.rolling) return;
  skinMenu.hidden = false;
  skinTrigger.setAttribute('aria-expanded', 'true');
  skinMenu.querySelector('[aria-checked="true"]')?.focus();
}

function renderSkinPicker() {
  const style = SKINS[state.skin];
  skinTriggerLabel.textContent = style.label;
  skinTrigger.setAttribute('aria-label', `Skin dos dados: ${style.label}`);
  skinPicker.style.setProperty('--skin-accent', style.accent);
  for (const button of skinMenu.querySelectorAll('[role="menuitemradio"]')) {
    button.setAttribute('aria-checked', String(button.dataset.value === state.skin));
  }
}

function selectSkin(skin) {
  if (state.rolling || !view.setSkin(skin)) return;
  state.skin = skin;
  renderSkinPicker();
  closeSkinMenu(true);
}

function setSkinControlsEnabled(enabled) {
  skinTrigger.disabled = !enabled;
  if (!enabled) closeSkinMenu();
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

for (const [skin, style] of Object.entries(SKINS)) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'skin-option';
  button.dataset.value = skin;
  button.setAttribute('role', 'menuitemradio');
  button.setAttribute('aria-checked', String(skin === state.skin));
  button.tabIndex = -1;
  button.style.setProperty('--skin-accent', style.accent);
  const swatch = document.createElement('span');
  swatch.className = 'skin-swatch';
  swatch.style.setProperty('--skin-accent', style.accent);
  swatch.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = style.label;
  button.append(swatch, label);
  button.addEventListener('click', () => selectSkin(skin));
  skinMenu.append(button);
}
renderSkinPicker();
skinTrigger.addEventListener('click', () => {
  if (skinMenu.hidden) openSkinMenu();
  else closeSkinMenu(true);
});
skinTrigger.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') { event.preventDefault(); openSkinMenu(); }
});
skinMenu.addEventListener('keydown', (event) => {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  event.preventDefault();
  const buttons = [...skinMenu.querySelectorAll('button')];
  const direction = event.key === 'ArrowDown' ? 1 : -1;
  buttons[(buttons.indexOf(document.activeElement) + direction + buttons.length) % buttons.length].focus();
});
document.addEventListener('pointerdown', (event) => {
  if (!skinPicker.contains(event.target)) closeSkinMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !skinMenu.hidden) { event.preventDefault(); closeSkinMenu(true); }
});

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
  const bonusText = bonusesInput.value.trim();
  const bonusParts = bonusText ? bonusText.split(/[,;\s]+/).filter(Boolean) : [];
  if (bonusParts.some((part) => !/^[+-]?\d+$/.test(part))) {
    throw new RangeError('Separe os bônus com vírgulas, por exemplo +3, +2.');
  }
  if (difficultyInput.value.trim() && !/^\d+$/.test(difficultyInput.value.trim())) {
    throw new RangeError('A CD deve estar entre 1 e 999.');
  }
  return {
    dice: state.dice,
    mode: state.mode,
    quantity: Number(quantityInput.value),
    modifier: Number(modifierInput.value),
    bonuses: bonusParts.map(Number),
    dc: difficultyInput.value.trim() ? Number(difficultyInput.value) : null,
  };
}

function formatTime(date) {
  return date.toLocaleTimeString('pt-BR', { hour12: false });
}

function renderResult(result, rerolled = false) {
  const percent = result.dice === 'dpercent' ? '%' : '';
  const label = result.dice === 'dpercent' ? 'D%' : result.dice.toUpperCase();
  resultValue.textContent = result.dice === 'd20'
    ? `D20: ${result.results[0].selected} • Total: ${result.total}`
    : result.quantity > 4
      ? `${result.quantity}${label} • Total: ${result.total}${percent}`
      : `${result.quantity > 1 ? result.quantity : ''}${label}: ${result.individual} • Total: ${result.total}${percent}`;
  resultValue.dataset.critical = result.critical || '';
  resultValue.dataset.phase = 'final';
  resultValue.dataset.outcome = result.outcome || '';
  rollBadge.textContent = result.critical === 'success' ? 'SUCESSO CRÍTICO'
    : result.critical === 'failure' ? 'FALHA CRÍTICA'
    : result.outcome === 'success' ? 'SUCESSO'
    : result.outcome === 'failure' ? 'FALHA'
    : rerolled ? 'RERROLAGEM' : 'ROLAGEM';
  resultMeta.textContent = [
    ...(result.quantity > 4 ? [`Dados: ${result.results.map((item) => item.selected).join(' + ')}`] : []),
    `Subtotal: ${result.subtotal}${percent}`,
    `Modificador: ${signed(result.modifier)}`,
    ...(result.bonuses.length ? [`Bônus: ${result.bonuses.map(signed).join(', ')}`] : []),
    ...(result.dc === null ? [] : [`CD: ${result.dc}`]),
    result.mode,
    ...(rerolled ? ['rerrolagem'] : []),
  ].join(' • ');
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

function waitStep(sequence, duration) {
  if (sequence.skipped || sequence.cancelled) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sequence.wake = null;
      resolve();
    }, duration);
    sequence.wake = () => {
      clearTimeout(timer);
      sequence.wake = null;
      resolve();
    };
  });
}

function skipSequence() {
  const sequence = state.sequence;
  if (!sequence) return;
  sequence.skipped = true;
  view.skipAnimation();
  sequence.wake?.();
}

function cancelSequence() {
  const sequence = state.sequence;
  if (!sequence) return;
  sequence.cancelled = true;
  view.cancelAnimation();
  sequence.wake?.();
  state.sequence = null;
  state.rolling = false;
  setSkinControlsEnabled(true);
  rollButton.textContent = '🎲 Rolar';
  rerollButton.disabled = true;
}

function revealRaw(result) {
  const label = result.dice === 'dpercent' ? 'D%' : result.dice.toUpperCase();
  const suffix = result.dice === 'dpercent' ? '%' : '';
  resultValue.textContent = `${result.quantity > 1 ? result.quantity : ''}${label}: ${result.results.map((item) => `${item.selected}${suffix}`).join(' + ')} • ${result.subtotal}${suffix}`;
  resultValue.dataset.phase = 'raw';
  rollBadge.textContent = 'VALOR BRUTO';
  resultMeta.textContent = result.dc === null ? 'Resultado do dado, antes dos modificadores.' : `Resultado do dado • CD ${result.dc}`;
}

function revealBonus(value, running, index, count, result) {
  rollBadge.textContent = `BÔNUS ${index + 1}/${count}`;
  resultValue.textContent = `${running - value} ${signed(value)} = ${running}`;
  resultValue.dataset.phase = 'bonus';
  resultValue.animate([{ opacity: .3, transform: 'translateY(5px) scale(.98)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 280, easing: 'ease-out' });
  resultMeta.textContent = `${result.individual} • ${index + 1} de ${count} modificadores${result.dc === null ? '' : ` • CD ${result.dc}`}`;
}

async function play(result, rerolled = false) {
  const sequence = { skipped: false, cancelled: false, wake: null };
  state.sequence = sequence;
  state.rolling = true;
  setSkinControlsEnabled(false);
  rollButton.textContent = 'Pular animação';
  rerollButton.disabled = true;
  rollBadge.textContent = 'ROLANDO...';
  resultValue.textContent = 'Os dados estão rolando...';
  resultValue.dataset.phase = 'rolling';
  resultValue.dataset.critical = '';
  resultValue.dataset.outcome = '';
  resultMeta.textContent = `${result.dice === 'dpercent' ? 'D%' : result.dice.toUpperCase()} • lançamento em andamento${result.dc === null ? '' : ` • CD ${result.dc}`}`;
  try {
    const completed = await view.animate(result.dice, result);
    if (!completed || sequence.cancelled) return;
    if (!sequence.skipped) {
      revealRaw(result);
      await waitStep(sequence, 300);
    }
    let running = result.subtotal;
    const bonuses = [result.modifier, ...result.bonuses].filter((value) => value !== 0);
    for (let index = 0; index < bonuses.length && !sequence.skipped && !sequence.cancelled; index++) {
      running += bonuses[index];
      revealBonus(bonuses[index], running, index, bonuses.length, result);
      await waitStep(sequence, 340);
    }
    if (sequence.cancelled) return;
    record(result, rerolled);
  } finally {
    if (state.sequence !== sequence) return;
    state.sequence = null;
    state.rolling = false;
    setSkinControlsEnabled(true);
    rollButton.textContent = '🎲 Rolar';
    rerollButton.disabled = !state.previous;
    if (state.previewPending) preview();
    state.previewPending = false;
  }
}

document.querySelector('#roll-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.rolling) { skipSequence(); return; }
  hideError();
  try {
    const result = rollDice(readOptions());
    state.previous = {
      dice: result.dice,
      quantity: result.quantity,
      modifier: result.modifier,
      mode: result.mode,
      bonuses: result.bonuses,
      dc: result.dc,
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
  if (state.rolling) cancelSequence();
  resultValue.textContent = 'Selecione um dado e clique em Rolar!';
  resultValue.dataset.critical = '';
  resultValue.dataset.outcome = '';
  resultValue.dataset.phase = 'ready';
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
