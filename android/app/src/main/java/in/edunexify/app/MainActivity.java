package in.edunexify.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Android 15+ (targetSdk 35+) forces edge-to-edge layout by default, which pushes
        // the WebView content under the status bar regardless of the StatusBar plugin's
        // overlaysWebView setting. Opting back out here restores the system's automatic
        // status/navigation bar space reservation.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}
