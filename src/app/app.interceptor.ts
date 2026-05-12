import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private router: Router) {}

  private getToken(): string {
    return (
      localStorage.getItem('jwtToken') ||
      localStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('jwt') ||
      sessionStorage.getItem('jwtToken') ||
      sessionStorage.getItem('token') ||
      sessionStorage.getItem('authToken') ||
      sessionStorage.getItem('access_token') ||
      sessionStorage.getItem('jwt') ||
      ''
    ).trim();
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.getToken();
    const selectedClient = (localStorage.getItem('selectedClient') || 'SALEM')
      .trim()
      .toUpperCase();

    const isAuthCall = req.url.toLowerCase().includes('/api/login');

    const headers: Record<string, string> = {};

    console.log('[AuthInterceptor] url =', req.url);
    console.log('[AuthInterceptor] token found =', !!token);
    console.log('[AuthInterceptor] selectedClient =', selectedClient);

    if (token && !isAuthCall) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('[AuthInterceptor] Authorization header attached');
    }

    if (!isAuthCall) {
      headers['X-Selected-Client'] = selectedClient;
    }

    const cloned = Object.keys(headers).length > 0
      ? req.clone({ setHeaders: headers })
      : req;

    return next.handle(cloned).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          console.error('[AuthInterceptor] 401 for request', req.url);
        }

        if (error.status === 401 && !isAuthCall && !this.router.url.startsWith('/login')) {
          this.router.navigate(['/login']);
        }

        return throwError(() => error);
      })
    );
  }
}