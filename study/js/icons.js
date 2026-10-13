// The only icons on the site: media controls. Inline SVG, so nothing extra downloads.

const paths = {
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
  replay: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
};

export function iconSvg(name, size = 20) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || ''}</svg>`;
}

// Returns a <span> holding the icon, ready to append.
export function icon(name, { size = 20, className = '' } = {}) {
  const span = document.createElement('span');
  span.className = `icon-wrap ${className}`.trim();
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = iconSvg(name, size);
  return span;
}
