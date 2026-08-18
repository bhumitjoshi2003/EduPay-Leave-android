import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

// Shared baseline for legacy smoke specs. Individual specs can still override
// these providers with focused spies when they exercise component behaviour.
beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
    ],
  });
});

describe('test environment', () => {
  it('provides shared Angular test dependencies', () => {
    expect(TestBed).toBeDefined();
  });
});
