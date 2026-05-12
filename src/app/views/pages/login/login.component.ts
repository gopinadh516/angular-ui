import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NgStyle, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconDirective } from '@coreui/icons-angular';
import { environment } from '../../../../environments/environment';
import {
  ContainerComponent,
  RowComponent,
  ColComponent,
  CardGroupComponent,
  TextColorDirective,
  CardComponent,
  CardBodyComponent,
  FormDirective,
  InputGroupComponent,
  InputGroupTextDirective,
  FormControlDirective,
  ButtonDirective
} from '@coreui/angular';
import { normalizeRole } from '../../../app-roles';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ContainerComponent,
    RowComponent,
    ColComponent,
    CardGroupComponent,
    TextColorDirective,
    CardComponent,
    CardBodyComponent,
    FormDirective,
    InputGroupComponent,
    InputGroupTextDirective,
    IconDirective,
    FormControlDirective,
    ButtonDirective,
    NgStyle
  ]
})
export class LoginComponent {
  email: string = environment.useMockData ? 'admin@surescripts.local' : '';
  password: string = environment.useMockData ? 'mock' : '';
  errorMessage: string = '';

  constructor(private router: Router, private http: HttpClient) {}

  private decodeBase64Url(value: string): string {
    let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    return atob(base64);
  }

  private getRoleFromToken(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) {
        return null;
      }

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
    } catch (e) {
      console.error('Unable to parse role from token', e);
      return null;
    }
  }

  private getDefaultLandingRoute(_role: string | null): string {
    return '/claimstatus';
  }

  login(): void {
    this.errorMessage = '';

    const loginData = {
      email: this.email,
      password: this.password
    };

    this.http.post<any>(`${environment.apiBaseUrl}/login`, loginData).subscribe({
      next: (response) => {
        console.log('LOGIN RESPONSE =', response);

        if (!response?.token) {
          this.errorMessage = 'Token missing in response.';
          return;
        }

        localStorage.setItem('jwtToken', response.token);

        const resolvedEmail = (response.email || this.email || '').trim().toLowerCase();
        localStorage.setItem('currentUserEmail', resolvedEmail);

        const userId = response.username || response.email || this.email || 'Unknown';
        localStorage.setItem('currentUserId', userId);

        const userRole = this.getRoleFromToken(response.token);

        console.log('stored currentUserEmail =', localStorage.getItem('currentUserEmail'));
        console.log('stored jwtToken exists =', !!localStorage.getItem('jwtToken'));
        console.log('userId =', userId);
        console.log('normalizedRole =', userRole);

        if (userRole) {
          localStorage.setItem('currentUserRole', userRole);
        } else {
          localStorage.removeItem('currentUserRole');
        }

        console.log('stored currentUserRole =', localStorage.getItem('currentUserRole'));

        const targetRoute = this.getDefaultLandingRoute(userRole);
        console.log('navigating to', targetRoute);

        this.router.navigate([targetRoute]);
      },
      error: (err: any) => {
        this.errorMessage = 'Invalid email or password';
        console.error('Login error:', err);
      }
    });
  }
}