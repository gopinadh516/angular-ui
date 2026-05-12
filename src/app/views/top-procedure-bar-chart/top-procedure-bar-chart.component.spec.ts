import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TopProcedureBarChartComponent } from './top-procedure-bar-chart.component';

describe('TopProcedureBarChartComponent', () => {
  let component: TopProcedureBarChartComponent;
  let fixture: ComponentFixture<TopProcedureBarChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopProcedureBarChartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TopProcedureBarChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
