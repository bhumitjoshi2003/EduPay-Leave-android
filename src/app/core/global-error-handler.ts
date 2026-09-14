import { ErrorHandler, Injectable, NgZone } from '@angular/core';
import { ObservabilityService } from './observability.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

  constructor(private observability: ObservabilityService, private zone: NgZone) {}

  handleError(error: unknown): void {
    // Run outside Angular's zone so the error handler itself
    // doesn't trigger additional change detection cycles.
    this.zone.runOutsideAngular(() => {
      this.observability.reportUnexpected(error, { operation: 'angular.runtime' });
    });
  }

}
