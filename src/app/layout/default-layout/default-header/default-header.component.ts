import { NgTemplateOutlet, NgIf } from '@angular/common';
import { Component, computed, inject, input, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  AvatarComponent,
  BadgeComponent,
  BreadcrumbRouterComponent,
  ColorModeService,
  ContainerComponent,
  DropdownComponent,
  DropdownDividerDirective,
  DropdownHeaderDirective,
  DropdownItemDirective,
  DropdownMenuDirective,
  DropdownToggleDirective,
  HeaderComponent,
  HeaderNavComponent,
  HeaderTogglerDirective,
  NavItemComponent,
  NavLinkDirective,
  SidebarToggleDirective
} from '@coreui/angular';

import { IconDirective } from '@coreui/icons-angular';
import { isDashboardRole, normalizeRole } from '../../../app-roles';

@Component({
  selector: 'app-default-header',
  templateUrl: './default-header.component.html',
  imports: [
    NgIf,
    CommonModule,
    ContainerComponent,
    HeaderTogglerDirective,
    SidebarToggleDirective,
    IconDirective,
    HeaderNavComponent,
    NavItemComponent,
    NavLinkDirective,
    RouterLink,
    RouterLinkActive,
    NgTemplateOutlet,
    BreadcrumbRouterComponent,
    DropdownComponent,
    DropdownToggleDirective,
    AvatarComponent,
    DropdownMenuDirective,
    DropdownHeaderDirective,
    DropdownItemDirective,
    BadgeComponent,
    DropdownDividerDirective
  ]
})
export class DefaultHeaderComponent extends HeaderComponent implements OnInit {
  readonly #colorModeService = inject(ColorModeService);
  readonly colorMode = this.#colorModeService.colorMode;

  readonly colorModes = [
    { name: 'light', text: 'Light', icon: 'cilSun' },
    { name: 'dark', text: 'Dark', icon: 'cilMoon' },
    { name: 'auto', text: 'Auto', icon: 'cilContrast' }
  ];

  readonly icons = computed(() => {
    const currentMode = this.colorMode();
    return this.colorModes.find(mode => mode.name === currentMode)?.icon ?? 'cilSun';
  });

  readonly clientStorageKey = 'selectedClient';
  readonly userEmailStorageKey = 'currentUserEmail';
  readonly defaultAvatarPath = './assets/images/avatars/8.jpg';

  clientOptions = [
    { code: 'SALEM', label: 'Salem' },
    { code: 'PALMERI', label: 'Palmeri' }
  ];

  selectedClient = 'SALEM';
  userAvatarSrc = this.defaultAvatarPath;

  sidebarId = input('sidebar1');

  showDashboardLinks = true;
  showClaimsListsLink = true;
  showArListsLink = true;

  constructor() {
    super();
  }

  ngOnInit(): void {
    const role = normalizeRole(localStorage.getItem('currentUserRole'));

    this.showDashboardLinks = isDashboardRole(role);
    this.showClaimsListsLink = !!role;
    this.showArListsLink = !!role;

    const savedClient = (localStorage.getItem(this.clientStorageKey) || 'SALEM')
      .trim()
      .toUpperCase();

    if (this.clientOptions.some(c => c.code === savedClient)) {
      this.selectedClient = savedClient;
    } else {
      this.selectedClient = 'SALEM';
    }

    localStorage.setItem(this.clientStorageKey, this.selectedClient);

    this.resolveUserAvatar();
  }

  private decodeBase64Url(value: string): string {
    let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    return atob(base64);
  }

  private decodeJwtPayload(token: string): any | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) {
        return null;
      }

      return JSON.parse(this.decodeBase64Url(parts[1]));
    } catch (e) {
      console.error('[Avatar] Unable to decode token payload', e);
      return null;
    }
  }

  private getEmailFromToken(): string {
    const token =
      localStorage.getItem('jwtToken') ||
      localStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('jwt') ||
      '';

    console.log('[Avatar] jwtToken exists =', !!localStorage.getItem('jwtToken'));
    console.log('[Avatar] token exists =', !!localStorage.getItem('token'));
    console.log('[Avatar] authToken exists =', !!localStorage.getItem('authToken'));

    if (!token) {
      console.log('[Avatar] No token found in localStorage');
      return '';
    }

    const payload = this.decodeJwtPayload(token);
    console.log('[Avatar] token payload =', payload);

    if (!payload) {
      return '';
    }

    const email =
      payload.email ||
      payload.sub ||
      payload.preferred_username ||
      payload.upn ||
      payload.unique_name ||
      '';

    return String(email).trim().toLowerCase();
  }

  private getLoggedInEmail(): string {
    const emailFromCurrentUserEmail = localStorage.getItem(this.userEmailStorageKey) || '';
    const emailFromEmail = localStorage.getItem('email') || '';
    const emailFromUserEmail = localStorage.getItem('userEmail') || '';

    console.log('[Avatar] currentUserEmail =', emailFromCurrentUserEmail);
    console.log('[Avatar] email =', emailFromEmail);
    console.log('[Avatar] userEmail =', emailFromUserEmail);

    const resolvedEmail =
      String(emailFromCurrentUserEmail || emailFromEmail || emailFromUserEmail)
        .trim()
        .toLowerCase() || this.getEmailFromToken();

    console.log('[Avatar] resolved email =', resolvedEmail);

    return resolvedEmail;
  }

  private buildAvatarPath(email: string): string {
    if (!email) {
      console.log('[Avatar] Email blank, using default avatar');
      return this.defaultAvatarPath;
    }

    const path = `./assets/images/avatars/${email}.jpg`;
    console.log('[Avatar] candidate avatar path =', path);
    return path;
  }

  private resolveUserAvatar(): void {
    const email = this.getLoggedInEmail();
    const candidatePath = this.buildAvatarPath(email);

    console.log('[Avatar] resolveUserAvatar email =', email);
    console.log('[Avatar] resolveUserAvatar candidatePath =', candidatePath);

    if (!email) {
      this.userAvatarSrc = this.defaultAvatarPath;
      console.log('[Avatar] No email found. Falling back to default avatar');
      return;
    }

    const img = new Image();

    img.onload = () => {
      console.log('[Avatar] Avatar image found for email =', email);
      this.userAvatarSrc = candidatePath;
    };

    img.onerror = () => {
      console.log('[Avatar] Avatar image NOT found for email =', email);
      console.log('[Avatar] Falling back to default avatar');
      this.userAvatarSrc = this.defaultAvatarPath;
    };

    img.src = candidatePath;
  }

  setSelectedClient(clientCode: string): void {
    const value = (clientCode || '').trim().toUpperCase();
    if (!value) {
      return;
    }

    this.selectedClient = value;
    localStorage.setItem(this.clientStorageKey, value);
    window.location.reload();
  }

  get selectedClientLabel(): string {
    return this.clientOptions.find(c => c.code === this.selectedClient)?.label ?? 'Salem';
  }

  onClientChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value?.trim().toUpperCase();
    if (!value) {
      return;
    }

    this.selectedClient = value;
    localStorage.setItem(this.clientStorageKey, value);
    window.location.reload();
  }

  public newMessages = [];
  public newNotifications = [];
  public newStatus = [];
  public newTasks = [];
}