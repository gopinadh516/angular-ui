import { Component, Inject, OnInit } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NgScrollbar } from 'ngx-scrollbar';

import {
  ContainerComponent,
  ShadowOnScrollDirective,
  SidebarBrandComponent,
  SidebarComponent,
  SidebarFooterComponent,
  SidebarHeaderComponent,
  SidebarNavComponent,
  SidebarToggleDirective,
  SidebarTogglerDirective
} from '@coreui/angular';

import { DefaultFooterComponent, DefaultHeaderComponent } from './';
import { navItems } from './_nav';
import { isArListRole, isClientRole, normalizeRole } from '../../app-roles';

@Component({
  selector: 'app-dashboard',
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
  imports: [
    SidebarComponent,
    SidebarHeaderComponent,
    SidebarBrandComponent,
    SidebarNavComponent,
    SidebarFooterComponent,
    SidebarToggleDirective,
    SidebarTogglerDirective,
    ContainerComponent,
    DefaultFooterComponent,
    DefaultHeaderComponent,
    NgScrollbar,
    RouterOutlet,
    RouterLink,
    ShadowOnScrollDirective
  ]
})
export class DefaultLayoutComponent implements OnInit {
  public navItems = [...navItems];

  constructor(@Inject(DOCUMENT) private document: Document) {}

  ngOnInit(): void {
    const role = normalizeRole(localStorage.getItem('currentUserRole'));

    if (isArListRole(role) || isClientRole(role)) {
      this.navItems = navItems.filter((item: any) =>
        item.url === '/ar-lists' ||
        (item.title === true && item.name === 'AR Actions')
      );
    }
  }

  toggleSidebar(): void {
    const body = this.document.body;
    const cl = body.classList;

    const hasCSidebar = !!this.document.querySelector('.c-sidebar');
    const SHOW  = hasCSidebar ? 'c-sidebar-show' : 'sidebar-show';
    const HIDE  = hasCSidebar ? 'c-sidebar-hide' : 'sidebar-hide';
    const NARROW = hasCSidebar ? 'c-sidebar-minimized' : 'sidebar-narrow';

    if (cl.contains(SHOW)) {
      cl.remove(SHOW);
      return;
    }

    const nowHidden = cl.toggle(HIDE);
    cl.remove(NARROW);

    if (!nowHidden) {
      cl.add(hasCSidebar ? 'c-sidebar-show' : 'sidebar-lg-show');
    }
  }
}
