import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideDemoAi } from './demo-ai';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(), provideDemoAi()],
};
