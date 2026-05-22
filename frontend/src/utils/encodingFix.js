// Small DOM text normalizer to fix mojibake without changing app structure
const LATIN1_ARTIFACT = /Ã[¡ÁÉÍÓÚÑáéíóúñ]|â[“”–—]|â€[“”]|Â|Å|Â·|â€¦|â€“|â€”|Â¿|Â¡/;
const COMMON_REPLACEMENTS = [
  ['â€”', '—'],
  ['â€“', '–'],
  ['â€œ', '“'],
  ['â€\u009d', '”'],
  ['â€™', '’'],
  ['â€¦', '…'],
  ['â‚¬', '€'],
  ['Â·', '·'],
  ['Â¿', '¿'],
  ['Â¡', '¡']
];

const decodeLatin1 = (value) => {
  const bytes = new Uint8Array(Array.from(value, (ch) => ch.charCodeAt(0) & 0xff));
  try {
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return value;
  }
};

const replaceAll = (value, from, to) => value.split(from).join(to);

export function applyEncodingFix(root) {
  if (!root || !root.querySelector) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const original = node.nodeValue;
    if (!original || !LATIN1_ARTIFACT.test(original)) return;

    let fixed = decodeLatin1(original);
    COMMON_REPLACEMENTS.forEach(([from, to]) => {
      fixed = replaceAll(fixed, from, to);
    });

    node.nodeValue = fixed;
  });
}
