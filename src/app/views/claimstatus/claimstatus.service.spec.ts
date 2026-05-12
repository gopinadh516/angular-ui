import { TestBed } from '@angular/core/testing';

import { ClaimstatusService } from './claimstatus.service';

describe('ClaimstatusService', () => {
  let service: ClaimstatusService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ClaimstatusService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
