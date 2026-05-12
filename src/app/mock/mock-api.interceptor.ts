import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpHeaders,
  HttpInterceptor,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { MOCK_DATA } from './mock-data';

@Injectable()
export class MockApiInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!environment.useMockData) {
      return next.handle(req);
    }

    const path = this.normalizePath(req.url);

    if (!path.startsWith('/api/')) {
      return next.handle(req);
    }

    const body = this.resolveBody(path, req);
    const headers = this.resolveHeaders(path, req);

    return of(new HttpResponse({ status: 200, body, headers, url: req.url })).pipe(delay(120));
  }

  private normalizePath(url: string): string {
    let pathname = url;
    try {
      pathname = new URL(url, window.location.origin).pathname;
    } catch {
      pathname = url.split('?')[0] || url;
    }

    const apiIndex = pathname.indexOf('/api/');
    return apiIndex >= 0 ? pathname.substring(apiIndex) : pathname;
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private makeMockJwt(role = 'SUPER_ADMIN', email = 'admin@surescripts.local'): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: email,
      email,
      role,
      userRole: role,
      authorities: [role],
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
    };

    const encode = (obj: unknown) => btoa(JSON.stringify(obj))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${encode(header)}.${encode(payload)}.mock-signature`;
  }

  private resolveHeaders(path: string, req: HttpRequest<any>): HttpHeaders {
    if (path.includes('/ar-list-export/dowload/')) {
      return new HttpHeaders({
        'content-disposition': 'attachment; filename="Mock_AR_FollowUp_List.xlsx"'
      });
    }
    if (path.includes('/followup-attachments/getfile/')) {
      return new HttpHeaders({
        'content-disposition': 'attachment; filename="mock-attachment.txt"'
      });
    }
    return new HttpHeaders();
  }

  private resolveBody(path: string, req: HttpRequest<any>): any {
    const method = req.method.toUpperCase();

    // Login: any email/password works in mock mode.
    if (path === '/api/login' && method === 'POST') {
      const email = (req.body?.email || 'admin@surescripts.local').trim().toLowerCase();
      const role = this.inferRoleFromEmail(email);
      localStorage.setItem('selectedClient', localStorage.getItem('selectedClient') || 'SALEM');
      return {
        token: this.makeMockJwt(role, email),
        username: email,
        email,
        role,
        userRole: role,
        selectedClient: 'SALEM'
      };
    }

    // Claim status / predicted payer follow-up.
    if (path === '/api/claim-status/all' && method === 'GET') return this.clone(MOCK_DATA.claimRows);
    if (path === '/api/predicted-payer-followup-list' && method === 'GET') return this.clone(MOCK_DATA.predictedPayerRows);
    if (path.startsWith('/api/predicted-payer-followup-list/run/') && method === 'GET') return this.clone(MOCK_DATA.predictedPayerRows);
    if (path === '/api/ar-aging/cell-click' && method === 'POST') return this.clone(MOCK_DATA.claimRows.slice(0, 3));
    if (path === '/api/claim-status/manual-update' && method === 'POST') return { success: true, message: 'Mock status updated.' };

    // AR follow-up lists and details.
    if ((path === '/api/ar/showVisibleListsForRole' || path === '/api/ar-followup/showVisibleListsForRole') && method === 'GET') return this.clone(MOCK_DATA.arFollowupLists);
    if (path.startsWith('/api/ar-followup/showARlists') && method === 'GET') return this.clone(MOCK_DATA.arFollowupLists);
    if (path === '/api/ar-followup/getallrevmaxusers' && method === 'GET') return this.clone(MOCK_DATA.users);
    if (path === '/api/ar-followup/assignarlist' && method === 'POST') return { success: true, message: 'Mock list assigned.' };
    if (path === '/api/ar-followup/lists' && method === 'POST') return { success: true, listNumber: 599, message: 'Mock AR follow-up list created.' };
    if (path.includes('/api/ar-followup/listDetails/') && method === 'GET') return this.rowsForList(path);
    if (path === '/api/ar-followup/assigned-claims' && method === 'GET') return this.clone(MOCK_DATA.claimRows.filter(r => !!r.listNumber));
    if (path.startsWith('/api/ar-followup/ar/followup-list/') && method === 'DELETE') return { success: true, message: 'Mock list deleted.' };
    if (path === '/api/ar/add-claims-to-existing-list' && method === 'POST') return { success: true, added: req.body?.claims?.length ?? 0, message: 'Mock claims added to list.' };
    if (path === '/api/ar/remove-claims-from-existing-list' && method === 'POST') return { success: true, removed: req.body?.claimNumbers?.length ?? 0, message: 'Mock claims removed from list.' };

    // AR history / lookup / attachments.
    if (path === '/api/ar/status-lookup' && method === 'GET') return this.clone(MOCK_DATA.statusLookup);
    if (path.startsWith('/api/ar/action-lookup/by-status/') && method === 'GET') {
      const statusId = path.split('/').pop() || '1';
      const map = MOCK_DATA.actionLookupByStatus as unknown as Record<string, readonly unknown[]>;
      return this.clone(map[statusId] || map['1']);
    }
    if (path === '/api/ar/followup-history/save' && method === 'POST') return { followupId: 9900, message: 'Mock follow-up saved.' };
    if (path.startsWith('/api/ar/followup-history/by-claim/') && method === 'GET') {
      const claim = decodeURIComponent(path.split('/by-claim/')[1] || '').split('?')[0];
      return this.clone(MOCK_DATA.history.filter(h => h.claimNumber === claim));
    }
    if (path.startsWith('/api/ar/followup-attachments/by-claim/') && method === 'GET') return this.clone(MOCK_DATA.attachments);
    if (path.startsWith('/api/ar/followup-attachments/by-followup/') && method === 'GET') {
      const id = Number(path.split('/').pop());
      return this.clone(MOCK_DATA.attachments.filter(a => a.followupId === id));
    }
    if (path.startsWith('/api/ar/followup-attachments/getfile/') && method === 'GET') return this.mockBlob('Mock attachment generated by frontend mock mode.');
    if (path === '/api/arattachement/saveARattach' && method === 'POST') return { success: true, attachmentId: 7999, message: 'Mock attachment uploaded.' };
    if (path.includes('/api/ar-list-export/dowload/') && method === 'GET') return this.mockBlob('Mock Excel export placeholder. Replace with real backend export outside mock mode.');

    // AR aging / tables / widgets.
    if (path === '/api/ar-aging/byClaimsAndDollar' && method === 'GET') return this.clone(MOCK_DATA.arData);
    if (path === '/api/ARData/ar-table' && method === 'GET') return this.clone(MOCK_DATA.arData.claims);
    if (path === '/api/claimtable/all' && method === 'GET') return this.clone(MOCK_DATA.claimTable);
    // First-pass rates bar chart: needs { payerDescription, firstPassRatePercentage }
    if (path === '/api/first-pass/rates' && method === 'GET') {
      return [
        { payerDescription: 'Total',                 firstPassRatePercentage: '91%' },
        { payerDescription: 'Blue Cross Blue Shield', firstPassRatePercentage: '94%' },
        { payerDescription: 'United Healthcare',      firstPassRatePercentage: '92%' },
        { payerDescription: 'Medicare',               firstPassRatePercentage: '96%' },
        { payerDescription: 'Aetna',                  firstPassRatePercentage: '89%' },
        { payerDescription: 'Cigna',                  firstPassRatePercentage: '90%' },
        { payerDescription: 'Humana',                 firstPassRatePercentage: '87%' }
      ];
    }
    // First-pass widget sparkline: needs { month, firstPassRatePct }
    if (path === '/api/first-pass-widget/monthWiseData' && method === 'GET') {
      const d = this.clone(MOCK_DATA.monthwiseData) as unknown as any[];
      return d.map(r => ({ month: r.month, firstPassRatePct: r.firstPassRate }));
    }
    // Clean-pass widget sparkline: needs { month, firstPassRatePct }
    if (path === '/api/clean-pass/rates' && method === 'GET') {
      const d = this.clone(MOCK_DATA.cleanPassRates) as unknown as any[];
      return d.map(r => ({ month: r.month, firstPassRatePct: r.rate }));
    }
    // Adjudication trend widget: needs { month, avgDaysToAdjudication }
    if (path === '/api/adjudication/trend-monthwise' && method === 'GET') {
      return [
        { month: 'Nov-25', avgDaysToAdjudication: 18.4 },
        { month: 'Dec-25', avgDaysToAdjudication: 17.2 },
        { month: 'Jan-26', avgDaysToAdjudication: 15.8 },
        { month: 'Feb-26', avgDaysToAdjudication: 16.9 },
        { month: 'Mar-26', avgDaysToAdjudication: 14.6 },
        { month: 'Apr-26', avgDaysToAdjudication: 13.2 }
      ];
    }
    // Collection trend: needs { month, totalCharges, totalCollected }
    if (path.startsWith('/api/collectionTrend/') && method === 'GET') {
      const d = this.clone(MOCK_DATA.collectionTrend) as unknown as any[];
      return d.map(r => ({ month: r.period, totalCharges: r.charges, totalCollected: r.collections }));
    }
    // Revenue distribution: needs { payerDescription, totalRevenue, revenuePercentage }
    if (path === '/api/revenue-distribution/rates' && method === 'GET') {
      const d = this.clone(MOCK_DATA.revenueDistribution) as unknown as any[];
      return d.map(r => ({ payerDescription: r.payer, totalRevenue: r.amount, revenuePercentage: r.percentage }));
    }
    if (path.startsWith('/api/denials/pareto/') && method === 'GET') return this.clone(MOCK_DATA.pareto);
    // Top procedures: needs { reasonCodes: string[], values: number[] }
    if (path === '/api/top/top10PCs' && method === 'GET') {
      const d = this.clone(MOCK_DATA.topProcedures) as unknown as any;
      return { reasonCodes: d.labels, values: d.values };
    }

    // Management dashboard reports.
    if ((path === '/api/showncr/byDateEntry' || path === '/api/showncr/byEntry' || path === '/api/showgcr/byDataDOS') && method === 'GET') return this.clone(MOCK_DATA.ncrRows);
    if (path === '/api/reports/pending-ar-snapshot-trend/daily' && method === 'GET') return this.clone(MOCK_DATA.pendingArTrend);
    if (path === '/api/reports/cpt-charge-payment' && method === 'POST') return this.clone(MOCK_DATA.cptReport);
    if (path === '/api/reports/cpt-charge-payment/detail' && method === 'POST') return this.clone(MOCK_DATA.cptDetail);
    if (path === '/api/reports/cpt-charge-payment/summary' && method === 'POST') return this.clone(MOCK_DATA.cptSummary);
    if (path === '/api/reports/clean-claim/summary' && method === 'POST') return this.clone(MOCK_DATA.cleanClaimSummary);
    if (path === '/api/reports/clean-claim/detail' && method === 'POST') return this.clone(MOCK_DATA.cleanClaimDetail);
    if (path === '/api/reports/liquidation-rate' && method === 'POST') return this.clone(MOCK_DATA.liquidationRate);

    // Operational reports.
    if (path === '/api/reports/physician-daily/physicians' && method === 'POST') return this.clone(MOCK_DATA.physicians);
    if (path === '/api/reports/physician-daily/facts' && method === 'POST') return this.clone(MOCK_DATA.physicianFacts);
    if (path === '/api/productivity-report/facts' && method === 'POST') return this.clone(MOCK_DATA.productivityFacts);
    if (path === '/api/productivity-report/collectors' && method === 'POST') return this.clone(MOCK_DATA.collectors);
    if (path === '/api/ar/payment-resolution/dashboard' && method === 'GET') return this.clone(MOCK_DATA.resolutionDashboard);
    if (path === '/api/ar/payment-resolution/summary' && method === 'GET') return this.clone(MOCK_DATA.resolutionDashboard.summary);
    if (path === '/api/ar/payment-resolution/detail' && method === 'GET') return this.clone(MOCK_DATA.resolutionDashboard.details);

    // Upload / AI coding.
    if ((path === '/api/files/upload' || path === '/api/files/trxdetails/uploadsave') && method === 'POST') return { message: 'Mock upload completed successfully.', inserted: 25 };
    if (path === '/api/coding/predict' && method === 'POST') return { cpt: '99213', icd: 'M54.50', confidence: 0.91, message: 'Mock prediction only.' };

    // Safe fallback so any screen can still render during UI beautification.
    if (method === 'GET') return [];
    return { success: true, message: `Mock ${method} response for ${path}` };
  }

  private rowsForList(path: string): any[] {
    const listNumber = Number(path.split('/').pop());
    const rows = MOCK_DATA.claimRows.filter(r => Number(r.listNumber) === listNumber);
    return this.clone(rows.length ? rows : MOCK_DATA.claimRows.filter(r => !!r.listNumber));
  }

  private mockBlob(text: string): Blob {
    return new Blob([text], { type: 'text/plain' });
  }

  private inferRoleFromEmail(email: string): string {
    const e = email.toLowerCase();
    if (e.includes('manager')) return 'AR_MANAGER';
    if (e.includes('ar.agent') || e.includes('agent')) return 'AR_AGENT';
    if (e.includes('code')) return 'CODE_AGENT';
    if (e.includes('charge')) return 'CHARGE_AGENT';
    if (e.includes('pay')) return 'PAY_AGENT';
    if (e.includes('client')) return 'CLIENT';
    if (e.includes('admin')) return 'SUPER_ADMIN';
    return 'SUPER_ADMIN';
  }
}
