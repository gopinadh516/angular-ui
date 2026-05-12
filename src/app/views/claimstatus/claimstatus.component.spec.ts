import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaimstatusComponent } from './claimstatus.component';

describe('ClaimstatusComponent', () => {
  let component: ClaimstatusComponent;
  let fixture: ComponentFixture<ClaimstatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClaimstatusComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClaimstatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
