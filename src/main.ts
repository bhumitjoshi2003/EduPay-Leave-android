import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { initializeObservability } from './app/core/observability.service';

initializeObservability();

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));  

