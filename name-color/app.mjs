import {MAX_LENGTH, normalizeColor, parse, plain, serialize, selectedRange, replaceText, paint, gradient} from './model.mjs';

const $ = id => document.getElementById(id);
const defaultPalette = [['#F1F1E8','Chalk'],['#C6ED85','Lime'],['#65D694','Mint'],['#70D9D1','Teal'],['#75BDF8','Sky'],['#A99CFA','Lilac'],['#ED92CB','Pink'],['#FF817E','Coral'],['#FF9700','Orange'],['#F5D879','Gold']];
const paletteKey = 'wasteland-name-palette-v1';
let palette = defaultPalette.map(([color]) => color+'FF'), editingPalette = false, selectedSwatch = -1;
try {
  const saved = JSON.parse(localStorage.getItem(paletteKey));
  if (Array.isArray(saved) && saved.length <= 24 && saved.every(color => typeof color === 'string' && normalizeColor(color))) palette = saved.map(normalizeColor);
} catch { /* Invalid or unavailable storage falls back to the default palette. */ }
const storageKey = 'wasteland-name-painter-v1';
let chars = parse('<color=#FF9700FF>Blessed</color> AK-74 Rifle [Reaper Squad]');
let range = [0,0], currentColor = '#FF9700FF', history = [], future = [], beforeEdit = null;
let composing = false, selecting = false, dismissed = '', toastTimer, menuPoint = null;
try {
  const saved = localStorage.getItem(storageKey);
  if (saved !== null) chars = parse(saved);
} catch { /* Storage is optional. */ }

function status(message, error = false) {
  clearTimeout(toastTimer);
  $('status').textContent = message;
  $('status').classList.toggle('error',error);
  $('status').hidden = false;
  toastTimer = setTimeout(() => { $('status').hidden = true; },error ? 5000 : 2500);
}
function remember() {
  history.push(chars.map(char => ({...char})));
  if (history.length > 80) history.shift();
  future = [];
}
function save() {
  try { localStorage.setItem(storageKey,serialize(chars)); } catch { /* Editing works without storage. */ }
}
const rangeKey = () => range.join(':');
function hideColors(dismiss = false) {
  if (dismiss) dismissed = rangeKey();
  $('color-menu').hidden = true;
  $('open-colors').setAttribute('aria-expanded','false');
}
function positionMenu() {
  const rect = $('name').getBoundingClientRect(), menu = $('color-menu');
  const viewport = window.visualViewport;
  const leftEdge = viewport?.offsetLeft || 0, topEdge = viewport?.offsetTop || 0;
  const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
  const left = menuPoint?.x ?? rect.left;
  let top = menuPoint?.y ?? rect.bottom+8;
  if (top+menu.offsetHeight > topEdge+height-12) top = Math.max(topEdge+12,rect.top-menu.offsetHeight-8);
  menu.style.left = Math.max(leftEdge+12,Math.min(left,leftEdge+width-menu.offsetWidth-12))+'px';
  menu.style.top = Math.max(topEdge+12,Math.min(top,topEdge+height-menu.offsetHeight-12))+'px';
}
function showColors(point = null, explicit = false) {
  if (!explicit && (range[1] <= range[0] || dismissed === rangeKey())) return;
  if (explicit) dismissed = '';
  menuPoint = point;
  $('color-menu').hidden = false;
  $('open-colors').setAttribute('aria-expanded','true');
  positionMenu();
}
function updateSelection() {
  const selected = range[1]-range[0];
  $('selection-info').textContent = selected ? `${selected} selected` : '';
  updatePaletteTools();
  if (!selected) hideColors();
}
function render({textChanged = false} = {}) {
  if (textChanged) $('name').value = plain(chars);
  $('preview').replaceChildren();
  for (const char of chars) {
    const span = document.createElement('span');
    span.textContent = char.text;
    if (char.color) span.style.color = char.color;
    $('preview').append(span);
  }
  if (!chars.length) $('preview').textContent = 'Your name';
  $('undo').disabled = !history.length;
  $('redo').disabled = !future.length;
  $('copy').disabled = !chars.length;
  $('copy-fallback').hidden = true;
  updateSelection();
}
function syncColor(color) {
  currentColor = color;
  $('hex').value = color;
  $('hex').setAttribute('aria-invalid','false');
  $('color').value = color.slice(0,7).toLowerCase();
  $('active-color').style.background = color;
  const opacity = Math.round(parseInt(color.slice(7,9),16)/255*100);
  $('opacity').value = opacity;
  $('opacity-value').textContent = opacity+'%';
  for (const [index,button] of Array.from($('palette').children).entries()) button.setAttribute('aria-pressed',String(editingPalette ? index === selectedSwatch : button.dataset.color === color));
}
function applyColor(color) {
  if (editingPalette || range[1] <= range[0]) return;
  remember();
  chars = paint(chars,...range,color);
  render(); save();
}
function renderPalette() {
  $('palette').replaceChildren();
  palette.forEach((color,index) => {
    const label = defaultPalette.find(([value]) => value+'FF' === color)?.[1] || 'Custom';
    const button = document.createElement('button');
    button.className = 'swatch';
    button.style.setProperty('--swatch',color);
    button.dataset.color = color;
    button.title = `${label} ${color}`;
    button.setAttribute('aria-label',`${label} ${color}`);
    button.addEventListener('click',() => {
      selectedSwatch = index;
      syncColor(color);
      if (!editingPalette) applyColor(color);
      updatePaletteTools();
    });
    $('palette').append(button);
  });
  syncColor(currentColor);
  updatePaletteTools();
  if (!$('color-menu').hidden) positionMenu();
}
function updatePaletteTools() {
  $('edit-palette').setAttribute('aria-pressed',String(editingPalette));
  $('edit-palette').textContent = editingPalette ? 'Done' : 'Edit palette';
  $('palette-edit').hidden = !editingPalette;
  $('update-swatch').disabled = $('delete-swatch').disabled = selectedSwatch < 0;
  const noPaint = editingPalette || range[1] <= range[0];
  $('apply').disabled = $('remove-color').disabled = noPaint;
  for (const button of document.querySelectorAll('[data-gradient]')) button.disabled = noPaint;
}
function persistPalette() {
  try { localStorage.setItem(paletteKey,JSON.stringify(palette)); }
  catch { status('Palette storage is unavailable. Changes last for this visit only.',true); }
  renderPalette();
}
function colorFromHex() {
  const color = normalizeColor($('hex').value);
  if (!color) { $('hex').setAttribute('aria-invalid','true'); status('Use six or eight hex digits, e.g. #FF9700FF.',true); }
  return color;
}
$('save-color').addEventListener('click',() => {
  const color = colorFromHex();
  if (!color) return;
  if (palette.includes(color)) { selectedSwatch = palette.indexOf(color); syncColor(color); updatePaletteTools(); return; }
  if (palette.length >= 24) { status('Palette is full. Delete a swatch before adding another.',true); return; }
  palette.push(color); selectedSwatch = palette.length-1; syncColor(color); persistPalette();
});
$('edit-palette').addEventListener('click',() => {
  editingPalette = !editingPalette;
  selectedSwatch = palette.indexOf(currentColor);
  renderPalette();
});
$('update-swatch').addEventListener('click',() => {
  const color = colorFromHex();
  if (!color || selectedSwatch < 0) return;
  palette[selectedSwatch] = color; syncColor(color); persistPalette();
});
$('delete-swatch').addEventListener('click',() => {
  if (selectedSwatch < 0) return;
  palette.splice(selectedSwatch,1); selectedSwatch = -1; persistPalette();
});
function captureSelection(show = true) {
  if (document.activeElement !== $('name') || composing) return;
  const next = selectedRange(chars,$('name').selectionStart,$('name').selectionEnd);
  if (next.join(':') !== rangeKey()) dismissed = '';
  range = next;
  updateSelection();
  if (show) showColors();
}
document.addEventListener('selectionchange',() => captureSelection(!selecting));
$('name').addEventListener('select',() => captureSelection(!selecting));
$('name').addEventListener('pointerdown',() => { selecting = true; hideColors(); });
document.addEventListener('pointerup',() => {
  if (!selecting) return;
  selecting = false;
  captureSelection();
});
$('name').addEventListener('keyup',event => { if (event.key !== 'Escape') captureSelection(); });
$('name').addEventListener('contextmenu',event => {
  captureSelection(false);
  if (range[1] > range[0]) { event.preventDefault(); showColors({x:event.clientX,y:event.clientY},true); }
});
$('open-colors').addEventListener('click',() => {
  $('color-menu').hidden ? showColors(null,true) : hideColors(true);
});
$('close-colors').addEventListener('click',() => {
  hideColors(true);
  $('name').focus({preventScroll:true});
});
document.addEventListener('keydown',event => {
  if (event.key === 'Escape' && !$('color-menu').hidden) {
    event.preventDefault(); hideColors(true); $('name').focus({preventScroll:true});
  }
});
document.addEventListener('pointerdown',event => {
  if (!$('color-menu').contains(event.target) && event.target !== $('name') && !$('open-colors').contains(event.target)) hideColors(true);
});
window.addEventListener('resize',() => { if (!$('color-menu').hidden) positionMenu(); });
window.visualViewport?.addEventListener('resize',() => { if (!$('color-menu').hidden) positionMenu(); });
window.addEventListener('scroll',() => hideColors(),{passive:true});
$('color-menu').querySelector('details').addEventListener('toggle',() => { if (!$('color-menu').hidden) positionMenu(); });
$('name').addEventListener('beforeinput',event => {
  if (!composing) beforeEdit = {start:$('name').selectionStart,end:$('name').selectionEnd,type:event.inputType};
});
$('name').addEventListener('compositionstart',() => { composing = true; beforeEdit = {start:$('name').selectionStart,end:$('name').selectionEnd}; hideColors(); });
$('name').addEventListener('compositionend',() => { composing = false; editText(); });
function editText() {
  if (composing || $('name').value === plain(chars)) return;
  remember();
  chars = replaceText(chars,$('name').value.slice(0,MAX_LENGTH),beforeEdit);
  beforeEdit = null;
  range = selectedRange(chars,$('name').selectionStart,$('name').selectionEnd);
  dismissed = ''; hideColors();
  render(); save();
}
$('name').addEventListener('input',editText);
// Existing colored names can be pasted directly, without a separate import panel.
$('name').addEventListener('paste',event => {
  const text = event.clipboardData?.getData('text/plain');
  if (!text || !/<\/?color\b/i.test(text)) return;
  event.preventDefault();
  try {
    const imported = parse(text);
    const [start,end] = selectedRange(chars,$('name').selectionStart,$('name').selectionEnd);
    // Use grapheme counts, rather than code-point counts, for cursor insertions.
    let offset = 0, cursor = 0;
    while (cursor < chars.length && offset < $('name').selectionStart) offset += chars[cursor++].text.length;
    const from = $('name').selectionStart === $('name').selectionEnd ? cursor : start;
    const to = $('name').selectionStart === $('name').selectionEnd ? cursor : end;
    const merged = [...chars.slice(0,from),...imported,...chars.slice(to)];
    if (plain(merged).length > MAX_LENGTH) throw new Error('Name is too long.');
    remember(); chars = merged; range = [from,from+imported.length];
    const selectionStart = plain(chars.slice(0,range[0])).length;
    const selectionEnd = plain(chars.slice(0,range[1])).length;
    render({textChanged:true});
    $('name').setSelectionRange(selectionStart,selectionEnd);
    save();
  } catch (error) { status(error.message,true); }
});
$('select-all').addEventListener('click',() => {
  range = [0,chars.length]; dismissed = '';
  $('name').focus({preventScroll:true}); $('name').select(); updateSelection(); showColors(null,true);
});
$('color').addEventListener('input',() => syncColor($('color').value.toUpperCase()+currentColor.slice(7,9)));
$('color').addEventListener('change',() => applyColor(currentColor));
$('opacity').addEventListener('input',() => {
  const percent = $('opacity').value;
  const alpha = Math.round(Number(percent)/100*255).toString(16).padStart(2,'0').toUpperCase();
  syncColor(currentColor.slice(0,7)+alpha);
  $('opacity').value = percent;
  $('opacity-value').textContent = percent+'%';
});
$('opacity').addEventListener('change',() => applyColor(currentColor));
function applyHex() {
  const color = colorFromHex();
  if (!color) return;
  syncColor(color); applyColor(color);
}
$('apply').addEventListener('click',applyHex);
$('hex').addEventListener('keydown',event => { if (event.key === 'Enter') applyHex(); });
$('remove-color').addEventListener('click',() => applyColor(null));
const gradients = {sunset:['#FFB64E','#F16BB1'],aurora:['#69DDAB','#AB88FF'],ice:['#79E9E1','#75A3FF']};
for (const button of document.querySelectorAll('[data-gradient]')) button.addEventListener('click',() => {
  if (editingPalette || range[1] <= range[0]) return;
  remember(); chars = gradient(chars,...range,...gradients[button.dataset.gradient]); render(); save();
});
function travel(source,destination) {
  if (!source.length) return;
  destination.push(chars); chars = source.pop(); range = [0,0];
  beforeEdit = null; hideColors(); render({textChanged:true}); save();
}
$('undo').addEventListener('click',() => travel(history,future));
$('redo').addEventListener('click',() => travel(future,history));
$('name').addEventListener('keydown',event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault(); event.shiftKey ? travel(future,history) : travel(history,future);
  }
});
$('copy').addEventListener('click',async () => {
  const text = serialize(chars);
  try {
    await navigator.clipboard.writeText(text);
    $('copy').textContent = 'Copied!';
    setTimeout(() => { $('copy').textContent = 'Copy name ↗'; },1600);
  } catch {
    const output = $('fallback-output');
    $('copy-fallback').hidden = false; output.value = text; output.focus(); output.select();
    status('Copy the selected name manually.');
  }
});
renderPalette();
render({textChanged:true});
