import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArFollowupListDetailsComponent } from './ar-followup-list-details.component';

describe('ArFollowupListDetailsComponent', () => {
  let component: ArFollowupListDetailsComponent;
  let fixture: ComponentFixture<ArFollowupListDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArFollowupListDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArFollowupListDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
