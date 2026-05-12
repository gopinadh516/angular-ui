import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RevenueDistributionComponent } from './revenue-distribution.component';

describe('RevenueDistributionComponent', () => {
  let component: RevenueDistributionComponent;
  let fixture: ComponentFixture<RevenueDistributionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RevenueDistributionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RevenueDistributionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
