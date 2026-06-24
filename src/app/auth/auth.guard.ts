import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from './auth-state.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authState = inject(AuthStateService);
  const router = inject(Router);

  if (authState.isLoggedIn()) {
    return true;
  }

  const url = state.url;
  if (url && url.startsWith('/') && !url.startsWith('//')) {
    localStorage.setItem('redirectUrl', url);
  }
  router.navigate(['/home']);
  return false;
};
