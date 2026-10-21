import { useState, useEffect } from 'react';

export interface RouteState {
  path: string;
  view: 'repositories' | 'scans' | 'findings' | 'fixes' | 'agents' | 'settings' | 'home';
  params: Record<string, string>;
  searchParams: URLSearchParams;
}

export function parseCurrentLocation(): RouteState {
  const pathname = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);
  const parts = pathname.split('/').filter(Boolean);

  let view: RouteState['view'] = 'repositories';
  const params: Record<string, string> = {};

  if (parts.length === 0 || parts[0] === 'repos' || parts[0] === 'repositories') {
    view = 'repositories';
    if (parts[1]) params.repoId = parts[1];
  } else if (parts[0] === 'home') {
    view = 'home';
  } else if (parts[0] === 'scans') {
    if (parts.length >= 2) {
      params.scanId = parts[1];
      if (parts[2] === 'findings') {
        view = 'findings';
        if (parts[3]) {
          params.findingId = parts[3];
        }
        if (parts[4] === 'fix') {
          params.tab = 'fix';
        }
      } else if (parts[2] === 'fixes') {
        view = 'fixes';
      } else {
        view = 'scans';
      }
    } else {
      view = 'scans';
    }
  } else if (parts[0] === 'findings') {
    view = 'findings';
    if (parts[1]) params.findingId = parts[1];
    if (parts[2] === 'fix') params.tab = 'fix';
  } else if (parts[0] === 'fixes' || parts[0] === 'remediation') {
    view = 'fixes';
    if (parts[1]) params.fixId = parts[1];
  } else if (parts[0] === 'agents') {
    view = 'agents';
  } else if (parts[0] === 'settings') {
    view = 'settings';
  }

  return { path: pathname, view, params, searchParams };
}

export function navigateTo(url: string) {
  if (window.location.pathname !== url) {
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

export function useAppRouter() {
  const [route, setRoute] = useState<RouteState>(parseCurrentLocation);

  useEffect(() => {
    const onLocationChange = () => {
      setRoute(parseCurrentLocation());
    };
    window.addEventListener('popstate', onLocationChange);
    return () => window.removeEventListener('popstate', onLocationChange);
  }, []);

  const navigate = (to: string) => {
    navigateTo(to);
  };

  return { route, navigate };
}
