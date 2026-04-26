import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'ias';

  async ngOnInit() {
    if (Capacitor.isNativePlatform()) {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Default });
      await StatusBar.setBackgroundColor({ color: '#1a237e' });
      await SplashScreen.hide({ fadeOutDuration: 300 });
    }
  }
}
