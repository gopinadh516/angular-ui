import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExcelArAgingComponent } from './excel-ar-aging.component';

describe('ExcelArAgingComponent', () => {
  let component: ExcelArAgingComponent;
  let fixture: ComponentFixture<ExcelArAgingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExcelArAgingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExcelArAgingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
