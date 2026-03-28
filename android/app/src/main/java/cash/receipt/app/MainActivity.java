package cash.receipt.app;

import android.os.Bundle;
import android.view.View;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.graphics.Insets;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Once the bridge WebView is ready, inject safe-area CSS variables
        // so env(safe-area-inset-*) works correctly on Android
        View rootView = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(rootView, (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout());
            float density = getResources().getDisplayMetrics().density;
            int top = Math.round(insets.top / density);
            int bottom = Math.round(insets.bottom / density);
            int left = Math.round(insets.left / density);
            int right = Math.round(insets.right / density);

            // Inject CSS custom properties that match env(safe-area-inset-*)
            String js = String.format(
                "document.documentElement.style.setProperty('--safe-area-inset-top', '%dpx');" +
                "document.documentElement.style.setProperty('--safe-area-inset-bottom', '%dpx');" +
                "document.documentElement.style.setProperty('--safe-area-inset-left', '%dpx');" +
                "document.documentElement.style.setProperty('--safe-area-inset-right', '%dpx');",
                top, bottom, left, right
            );

            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(js, null);
            }

            return windowInsets;
        });
    }
}
