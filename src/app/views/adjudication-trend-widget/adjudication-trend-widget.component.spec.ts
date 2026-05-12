import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdjudicationTrendWidgetComponent } from './adjudication-trend-widget.component';

describe('AdjudicationTrendWidgetComponent', () => {
  let component: AdjudicationTrendWidgetComponent;
  let fixture: ComponentFixture<AdjudicationTrendWidgetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdjudicationTrendWidgetComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdjudicationTrendWidgetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
