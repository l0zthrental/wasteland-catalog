export const MAX_LENGTH = 2000;
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, {granularity:'grapheme'}) : null;
export const split = text => segmenter ? Array.from(segmenter.segment(text), part => part.segment) : Array.from(text);

export function normalizeColor(value) {
  const hex = value.trim().replace(/^#/, '').toUpperCase();
  return /^(?:[\dA-F]{6}|[\dA-F]{8})$/.test(hex) ? '#' + hex + (hex.length === 6 ? 'FF' : '') : null;
}

export function parse(text) {
  if (text.length > 64000) throw new Error('Pasted tags are too long. Use a shorter name.');
  const stack = [null], result = [];
  for (const token of text.split(/(<[^>]*>)/g)) {
    if (!token) continue;
    const open = token.match(/^<color\s*=\s*["']?(#[\da-f]{6}(?:[\da-f]{2})?)["']?\s*>$/i);
    if (open) stack.push(normalizeColor(open[1]));
    else if (/^<\/color\s*>$/i.test(token)) {
      if (stack.length === 1) throw new Error('A closing color tag has no opening tag.');
      stack.pop();
    } else {
      if (/^<\/?color\b/i.test(token)) throw new Error('Invalid color tag. Use <color=#RRGGBB> or <color=#RRGGBBAA>.');
      if (/^<[^>]*>$/.test(token)) throw new Error('Only color tags are supported. Remove other markup before importing.');
      result.push(...split(token).map(text => ({text, color:stack.at(-1)})));
    }
  }
  if (stack.length !== 1) throw new Error('A color tag is missing </color>.');
  if (plain(result).length > MAX_LENGTH) throw new Error(`Names must fit within ${MAX_LENGTH} characters in this editor.`);
  return result;
}

export const plain = chars => chars.map(char => char.text).join('');

export function serialize(chars) {
  let output = '', active = null;
  for (const char of chars) {
    if (char.color !== active) {
      if (active) output += '</color>';
      if (char.color) output += `<color=${char.color}>`;
      active = char.color;
    }
    output += char.text;
  }
  return output + (active ? '</color>' : '');
}

// Textarea offsets are UTF-16; selection must never split a visible character.
export function selectedRange(chars, start, end) {
  let offset = 0;
  const indices = [];
  chars.forEach((char, index) => {
    const next = offset + char.text.length;
    if (offset < end && next > start) indices.push(index);
    offset = next;
  });
  return indices.length ? [indices[0], indices.at(-1) + 1] : [0, 0];
}

export function replaceText(chars, text, edit = null) {
  const before = split(plain(chars)), after = split(text);
  if (edit && edit.start === edit.end) {
    if (edit.type === 'deleteContentBackward') {
      const prior = split(plain(chars).slice(0,edit.start)).at(-1);
      edit = {...edit,start:Math.max(0,edit.start-(prior?.length || 0))};
    } else if (edit.type === 'deleteContentForward') {
      const next = split(plain(chars).slice(edit.end))[0];
      edit = {...edit,end:edit.end+(next?.length || 0)};
    }
  }
  let prefix = 0, suffix = 0;
  // A recorded selection disambiguates deletions within repeated letters.
  const boundary = edit ? selectedRange(chars, edit.start, edit.end) : null;
  const cap = edit ? split(plain(chars).slice(0, edit.start)).length : Infinity;
  while (prefix < Math.min(before.length, after.length, cap) && before[prefix] === after[prefix]) prefix++;
  const maxSuffix = edit && boundary && edit.end > edit.start ? before.length - boundary[1] : before.length - prefix;
  while (suffix < Math.min(before.length - prefix, after.length - prefix, maxSuffix) && before[before.length-1-suffix] === after[after.length-1-suffix]) suffix++;
  const inherited = chars[prefix]?.color ?? chars[prefix-1]?.color ?? null;
  return [...chars.slice(0,prefix), ...after.slice(prefix, after.length-suffix).map(text => ({text,color:inherited})), ...(suffix ? chars.slice(-suffix) : [])];
}

export function paint(chars, start, end, color) {
  return chars.map((char, i) => i >= start && i < end ? {...char,color} : char);
}

export function gradient(chars, start, end, from, to) {
  const a = [1,3,5].map(i => parseInt(from.slice(i,i+2),16));
  const b = [1,3,5].map(i => parseInt(to.slice(i,i+2),16));
  return chars.map((char,i) => {
    if (i < start || i >= end) return char;
    const t = (i-start) / Math.max(1,end-start-1);
    const color = '#' + a.map((n,j) => Math.round(n+(b[j]-n)*t).toString(16).padStart(2,'0')).join('').toUpperCase() + 'FF';
    return {...char,color};
  });
}
