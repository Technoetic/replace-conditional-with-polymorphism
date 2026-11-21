export const ROUTES = [
  { id: 'intro', path: '/', label: '시작' },
  { id: 'read', path: '/read', label: '분기 해부' },
  { id: 'split', path: '/split', label: '책임 옮기기' },
  { id: 'lab', path: '/lab', label: '확장 실험실' },
  { id: 'practice', path: '/practice', label: '여섯 문제' },
  { id: 'code', path: '/code', label: '코드와 정리' }
];

export function normalizePath(raw = '') {
  const clean = String(raw || '').replace(/^#/, '').split('?')[0].trim();
  if (!clean || clean === '/') return '/';
  const withSlash = clean.startsWith('/') ? clean : '/' + clean;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
}

export function parseRoute(hash = '') {
  const path = normalizePath(hash);
  const match = ROUTES.find(r => r.path === path);
  return { path, id: match?.id || null, known: !!match };
}

export function routeUrl(route, baseUrl) {
  const url = new URL(baseUrl);
  const path = normalizePath(route);
  url.hash = '#' + path;
  return url;
}
