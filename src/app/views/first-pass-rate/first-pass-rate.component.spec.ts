import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FirstPassRateComponent } from './first-pass-rate.component';

describe('FirstPassRateComponent', () => {
  let component: FirstPassRateComponent;
  let fixture: ComponentFixture<FirstPassRateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FirstPassRateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FirstPassRateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
