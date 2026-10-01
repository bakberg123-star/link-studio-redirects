const STORAGE_KEY = 'link-studio-links-v1';
const MAX_COUNT = 10000;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const $ = id => document.getElementById(id);
const form = $('generator');
let links = loadLinks();

function loadLinks() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter(x => typeof x === 'string' && x.startsWith(`${location.origin}/go/`)) : [];
  } catch { return []; }
}

function saveLinks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(links)); }
  catch { setStatus('Ссылки созданы, но браузер не смог сохранить список. Скачайте CSV.'); }
}

function setStatus(message) { $('status').textContent = message; }

function randomCode(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => ALPHABET[byte % ALPHABET.length]).join('');
}

function render() {
  $('total').textContent = links.length.toLocaleString('ru-RU');
  $('empty').hidden = links.length > 0;
  $('list-wrap').hidden = links.length === 0;
  for (const id of ['copy', 'csv', 'clear']) $(id).disabled = links.length === 0;
  const list = $('list');
  list.replaceChildren();
  const shown = links.slice(-200).reverse();
  const start = links.length;
  shown.forEach((url, i) => {
    const row = document.createElement('div'); row.className = 'row';
    const index = document.createElement('span'); index.className = 'row-index'; index.textContent = String(start - i);
    const anchor = document.createElement('a'); anchor.href = url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.textContent = url;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'row-copy'; button.textContent = 'Копировать';
    button.addEventListener('click', async () => { await copyText(url); button.textContent = 'Готово'; setTimeout(() => button.textContent = 'Копировать', 1600); });
    row.append(index, anchor, button); list.append(row);
  });
  $('more').hidden = links.length <= shown.length;
  $('more').textContent = `Показаны последние ${shown.length} ссылок. Полный список доступен в CSV.`;
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
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT || !/^[a-z0-9-]{1,24}$/.test(prefix)) {
    setStatus('Проверьте количество и префикс.'); return;
  }
  const existing = new Set(links);
  const batch = [];
  while (batch.length < count) {
    const url = `${location.origin}/go/${prefix}-${randomCode(length)}`;
    if (!existing.has(url)) { existing.add(url); batch.push(url); }
  }
  links.push(...batch);
  saveLinks(); render();
  setStatus(`Создано ${count.toLocaleString('ru-RU')} ссылок.`);
});

$('copy').addEventListener('click', () => copyText(links.join('\n')));
$('csv').addEventListener('click', () => {
  const csv = '\ufeffnumber,url\r\n' + links.map((url, i) => `${i + 1},${url}`).join('\r\n') + '\r\n';
  const objectUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = objectUrl; anchor.download = 'links.csv'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
  setStatus('CSV скачан.');
});
$('clear').addEventListener('click', () => {
  if (!confirm(`Очистить список из ${links.length} ссылок в этом браузере? Сами ссылки продолжат работать.`)) return;
  links = []; saveLinks(); render(); setStatus('Список очищен.');
});
render();
