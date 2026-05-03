import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './components/toast/toast-container.component';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App } from '@capacitor/app';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'ias';

  constructor(private router: Router) {}

  async ngOnInit() {
    if (Capacitor.isNativePlatform()) {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Default });
      await StatusBar.setBackgroundColor({ color: '#1a237e' });
      await SplashScreen.hide({ fadeOutDuration: 300 });

      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });

      // Handle deep links — e.g. password-reset email clicking in Android
      App.addListener('appUrlOpen', ({ url }) => {
        try {
          const parsed = new URL(url);
          if (parsed.pathname === '/reset-password') {
            const token = parsed.searchParams.get('token');
            if (token) {
              this.router.navigate(['/reset-password'], { queryParams: { token } });
            }
          }
        } catch {
          // malformed URL — ignore
        }
      });
    }
  }

  ngOnDestroy() {
    if (Capacitor.isNativePlatform()) {
      App.removeAllListeners();
    }
  }
}
