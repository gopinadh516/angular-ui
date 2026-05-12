import { INavData } from '@coreui/angular';
import { normalizeRole, VIEW_AR_LIST_ROLES } from '../../app-roles';

const currentRole = normalizeRole(localStorage.getItem('currentUserRole'));
const canViewArLists = VIEW_AR_LIST_ROLES.includes(currentRole as any);
const canViewProductivityReport =
  currentRole === 'ADMIN' ||
  currentRole === 'SUPER_ADMIN' ||
  currentRole === 'AR_MANAGER';

export const navItems: INavData[] = [
  {
    name: 'Dashboard',
    url: '/management-dashboard',
    iconComponent: { name: 'cil-chart-pie' },
  },
  {
    name: 'AR Center',
    url: '/dashboard',
    iconComponent: { name: 'cil-institution' },
  },
  {
    name: 'AR Reports',
    url: '/management-dashboard',
    iconComponent: { name: 'cil-speedometer' },
    children: [
      {
        name: 'Visit Summary',
        url: '/physician-daily-report',
        icon: 'nav-icon-bullet',
      },
      {
        name: 'Resolution',
        url: '/resolution-report',
        icon: 'nav-icon-bullet',
      },
      ...(canViewProductivityReport
        ? [
            {
              name: 'Productivity',
              url: '/productivity-report',
              icon: 'nav-icon-bullet',
            } as INavData,
          ]
        : []),
    ],
  },
  {
    title: true,
    name: 'AR Actions',
  },

  ...(canViewArLists
    ? [
        {
          name: 'View AR Lists',
          url: '/ar-lists',
          iconComponent: { name: 'cil-list' },
        } as INavData,
      ]
    : []),

  {
    name: 'Upload',
    url: '/upload',
    iconComponent: { name: 'cil-cloud-upload' },
  },
  {
    name: 'Encounters',
    url: '/encounters',
    iconComponent: { name: 'cil-clipboard' },
  },
  {
    name: 'Auto Coding',
    url: '/autocoding',
    iconComponent: { name: 'cil-code' },
  },
  {
    name: 'Lead Times',
    url: '/lead-times',
    iconComponent: { name: 'cil-clipboard' },
  },
  {
    name: 'AR Aging',
    url: '/ar-aging',
    iconComponent: { name: 'cil-bar-chart' },
  }
];