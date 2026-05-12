import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
  UrlTree
} from '@angular/router';
import { normalizeRole } from './app-roles';

@Injectable({ providedIn: 'root' })
export class AppRoleGuard implements CanActivate {
  constructor(private router: Router) {}

  private decodeBase64Url(value: string): string {
    let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    return atob(base64);
  }

  private getRoleFromToken(token: string | null): string | null {
    if (!token) return null;

    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;

      const payload = JSON.parse(this.decodeBase64Url(parts[1]));

      let role =
        payload?.role ??
        payload?.userRole ??
        payload?.authorities ??
        payload?.authority;

      if (Array.isArray(role) && role.length > 0) {
        role = role[0];
      }

      return normalizeRole(typeof role === 'string' ? role : null);
    } catch {
      return null;
    }
  }

  private getCurrentRole(): string | null {
    const storedRole = localStorage.getItem('currentUserRole');
    if (storedRole) return normalizeRole(storedRole);

    const token = localStorage.getItem('jwtToken');
    const tokenRole = this.getRoleFromToken(token);

    if (tokenRole) {
      localStorage.setItem('currentUserRole', tokenRole);
    }

    return tokenRole;
  }

  private getDefaultLandingByRole(_role: string | null): UrlTree {
    return this.router.parseUrl('/claimstatus');
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    const expectedRoles = (route.data['roles'] as string[] | undefined)
      ?.map(r => normalizeRole(r))
      .filter((r): r is string => !!r);

    const role = this.getCurrentRole();

   // console.log('ROLE GUARD url =', state.url);
   // console.log('ROLE GUARD role =', role);
   // console.log('ROLE GUARD expectedRoles =', expectedRoles);

    if (!expectedRoles || expectedRoles.length === 0) {
      console.log('ROLE GUARD allowing because no expectedRoles');
      return true;
    }

    if (role && expectedRoles.includes(role)) {
    //  console.log('ROLE GUARD allowing role =', role);
      return true;
    }

 //   console.log('ROLE GUARD redirecting for role =', role);
    return this.getDefaultLandingByRole(role);
  }
}