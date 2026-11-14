// A cor que o canvas lê: o token passa por um elemento (os color-mix() saem como #rrggbb)
export const resolveColor = (root: HTMLElement, css: string) => {
  const probe = document.createElement('span');
  probe.style.color = css;
  root.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  if (computed.startsWith('rgb')) return computed;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return computed;
  context.fillStyle = computed;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
};
