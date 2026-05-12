import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutocodingComponent } from './autocoding.component';

describe('AutocodingComponent', () => {
  let component: AutocodingComponent;
  let fixture: ComponentFixture<AutocodingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutocodingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AutocodingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
