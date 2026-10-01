const STORAGE_KEY = 'link-studio-links-v1';
const TARGET_KEY = 'link-studio-target-v1';
const LEGACY_TARGET = 'https://oopsie.bio/ashleywow';
const MAX_COUNT = 10000;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const $ = id => document.getElementById(id);
const form = $('generator');
let links = loadLinks();
const selected = new Set();
try { $('destination').value = localStorage.getItem(TARGET_KEY) || LEGACY_TARGET; } catch {}

function loadLinks() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter(x => typeof x === 'string' && (x.startsWith(`${location.origin}/go/`) || x.startsWith(`${location.origin}/to/`))) : [];
  } catch { return []; }
}

function saveLinks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(links)); return true; }
  catch { setStatus('Браузер не смог сохранить список. Скачайте Excel до закрытия страницы.'); return false; }
}

function setStatus(message) { $('status').textContent = message; }

function randomCode(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => ALPHABET[byte % ALPHABET.length]).join('');
}

function encodeTarget(target) {
  const bytes = new TextEncoder().encode(target);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function targetOf(url) {
  try {
    const parts = new URL(url).pathname.split('/');
    if (parts[1] === 'go') return LEGACY_TARGET;
    if (parts[1] === 'to') {
      const base64 = parts[2].replace(/-/g, '+').replace(/_/g, '/');
      const bytes = Uint8Array.from(atob(base64), x => x.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
  } catch {}
  return '';
}

function allRows() { return links.map((url, index) => ({ url, index, target: targetOf(url) })); }

function filteredRows() {
  const target = $('target-filter').value;
  const rows = allRows().filter(row => !target || row.target === target);
  const sort = $('sort').value;
  if (sort === 'newest') rows.sort((a, b) => b.index - a.index);
  if (sort === 'oldest') rows.sort((a, b) => a.index - b.index);
  if (sort === 'target-asc') rows.sort((a, b) => a.target.localeCompare(b.target) || b.index - a.index);
  if (sort === 'target-desc') rows.sort((a, b) => b.target.localeCompare(a.target) || b.index - a.index);
  return rows;
}

function refreshTargets() {
  const filter = $('target-filter');
  const current = filter.value;
  const targets = [...new Set(links.map(targetOf))].filter(Boolean).sort((a, b) => a.localeCompare(b));
  filter.replaceChildren(new Option('Все адреса', ''));
  targets.forEach(target => filter.add(new Option(target, target)));
  filter.value = targets.includes(current) ? current : '';
}

function actionRows() {
  const rows = filteredRows();
  return selected.size ? rows.filter(row => selected.has(row.url)) : rows;
}

function render() {
  refreshTargets();
  const rows = filteredRows();
  const available = new Set(links);
  for (const url of selected) if (!available.has(url)) selected.delete(url);
  const selectedHere = rows.filter(row => selected.has(row.url)).length;
  $('total').textContent = links.length.toLocaleString('ru-RU');
  $('visible-count').textContent = `Найдено: ${rows.length.toLocaleString('ru-RU')} · Выбрано: ${selectedHere.toLocaleString('ru-RU')}`;
  $('selection-hint').textContent = selectedHere
    ? 'Копирование и Excel включат только выбранные ссылки.'
    : 'Если ссылки не отмечены, копируются и выгружаются все отфильтрованные.';
  $('empty').hidden = rows.length > 0;
  $('empty').textContent = links.length ? 'Для этого адреса ссылок пока нет.' : 'Создайте первую партию — ссылки появятся здесь.';
  $('list-wrap').hidden = rows.length === 0;
  for (const id of ['copy', 'excel', 'select-filtered', 'delete-filtered']) $(id).disabled = rows.length === 0;
  $('unselect').disabled = selected.size === 0;
  $('delete-selected').disabled = selectedHere === 0;
  $('clear').disabled = links.length === 0;
  const list = $('list');
  list.replaceChildren();
  const shown = rows.slice(0, 200);
  shown.forEach(item => {
    const row = document.createElement('div'); row.className = 'row';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'row-check'; checkbox.checked = selected.has(item.url); checkbox.setAttribute('aria-label', `Выбрать ссылку ${item.index + 1}`);
    checkbox.addEventListener('change', () => { if (checkbox.checked) selected.add(item.url); else selected.delete(item.url); render(); });
    const index = document.createElement('span'); index.className = 'row-index'; index.textContent = String(item.index + 1);
    const main = document.createElement('div'); main.className = 'row-main';
    const anchor = document.createElement('a'); anchor.href = item.url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.textContent = item.url;
    const target = document.createElement('span'); target.className = 'row-target'; target.textContent = `→ ${item.target}`;
    main.append(anchor, target);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'row-copy'; button.textContent = 'Копировать';
    button.addEventListener('click', async () => { await copyText(item.url); button.textContent = 'Готово'; setTimeout(() => button.textContent = 'Копировать', 1600); });
    row.append(checkbox, index, main, button); list.append(row);
  });
  $('more').hidden = rows.length <= shown.length;
  $('more').textContent = `На экране первые ${shown.length} из ${rows.length.toLocaleString('ru-RU')}. Кнопка «Выбрать отфильтрованные» охватывает весь список.`;
}

async function copyText(value) {
  try { await navigator.clipboard.writeText(value); setStatus('Скопировано.'); }
  catch { setStatus('Копирование недоступно. Скачайте CSV.'); }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const count = Number($('count').value);
  const prefix = $('prefix').value.toLowerCase();
  const length = Number($('length').value);
  let target;
  try {
    target = new URL($('destination').value.trim());
    if (target.protocol !== 'https:' || target.username || target.password || target.href.length > 2048 || target.hostname === location.hostname) throw new Error('invalid');
  } catch { setStatus('Введите корректный HTTPS-адрес назначения.'); return; }
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT || !/^[a-z0-9-]{1,24}$/.test(prefix)) {
    setStatus('Проверьте количество и префикс.'); return;
  }
  const existing = new Set(links);
  const batch = [];
  const encodedTarget = encodeTarget(target.href);
  while (batch.length < count) {
    const url = `${location.origin}/to/${encodedTarget}/${prefix}-${randomCode(length)}`;
    if (!existing.has(url)) { existing.add(url); batch.push(url); }
  }
  links.push(...batch);
  try { localStorage.setItem(TARGET_KEY, target.href); } catch {}
  const saved = saveLinks(); refreshTargets(); $('target-filter').value = target.href; selected.clear(); render();
  if (saved) setStatus(`Создано ${count.toLocaleString('ru-RU')} ссылок.`);
});

$('target-filter').addEventListener('change', () => { selected.clear(); render(); });
$('sort').addEventListener('change', render);
$('select-filtered').addEventListener('click', () => { filteredRows().forEach(row => selected.add(row.url)); render(); });
$('unselect').addEventListener('click', () => { selected.clear(); render(); });
$('copy').addEventListener('click', () => copyText(actionRows().map(row => row.url).join('\n')));
$('excel').addEventListener('click', () => {
  const rows = actionRows();
  try {
    const workbook = window.buildExcelWorkbook(rows);
    const objectUrl = URL.createObjectURL(new Blob([workbook], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const anchor = document.createElement('a'); anchor.href = objectUrl; anchor.download = 'links.xlsx'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    setStatus(`В Excel выгружено ${rows.length.toLocaleString('ru-RU')} ссылок.`);
  } catch { setStatus('Не удалось создать Excel-файл.'); }
});

function deleteRows(rows, label) {
  if (!rows.length || !confirm(`${label}: ${rows.length} ссылок? Список в этом браузере будет очищен, но сами ссылки продолжат работать.`)) return;
  const removing = new Set(rows.map(row => row.url));
  links = links.filter(url => !removing.has(url));
  selected.clear(); saveLinks(); render();
  setStatus(`Удалено из списка: ${removing.size.toLocaleString('ru-RU')}.`);
}

$('delete-selected').addEventListener('click', () => deleteRows(filteredRows().filter(row => selected.has(row.url)), 'Удалить выбранные'));
$('delete-filtered').addEventListener('click', () => deleteRows(filteredRows(), 'Удалить отфильтрованные'));
$('clear').addEventListener('click', () => {
  deleteRows(allRows(), 'Очистить весь список');
});
render();
