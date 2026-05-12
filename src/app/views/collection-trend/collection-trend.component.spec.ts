import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CollectionTrendComponent } from './collection-trend.component';

describe('CollectionTrendComponent', () => {
  let component: CollectionTrendComponent;
  let fixture: ComponentFixture<CollectionTrendComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollectionTrendComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CollectionTrendComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
