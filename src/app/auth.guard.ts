import { Injectable } from '@angular/core';
import {
  CanActivate,
  CanLoad,
  CanMatch,
  Route,
  UrlSegment,
  Router,
  UrlTree
} from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate, CanLoad, CanMatch {
  constructor(private router: Router) {}

  private hasToken(): boolean {
    return !!localStorage.getItem('jwtToken');
  }

  private toLogin(): UrlTree {
    return this.router.parseUrl('/login');
  }

  canActivate(): boolean | UrlTree {
    return this.hasToken() ? true : this.toLogin();
  }

  canLoad(_route: Route, _segments: UrlSegment[]): boolean | UrlTree {
    return this.hasToken() ? true : this.toLogin();
  }

  canMatch(_route: Route, _segments: UrlSegment[]): boolean | UrlTree {
    return this.hasToken() ? true : this.toLogin();
  }
}