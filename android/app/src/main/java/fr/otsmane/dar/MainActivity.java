package fr.otsmane.dar;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "DarMainActivity";
    private String pendingICSContent = null;
    private String pendingICSFileName = "rendez-vous.ics";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) {
            return;
        }

        Uri uri = intent.getData();
        if (uri == null) {
            return;
        }

        Log.d(TAG, "Incoming VIEW intent for calendar/ICS: " + uri);

        try {
            InputStream is = getContentResolver().openInputStream(uri);
            if (is != null) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(is));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line).append("\n");
                }
                is.close();

                String content = sb.toString();
                if (content.contains("BEGIN:VCALENDAR") || content.contains("BEGIN:VEVENT")) {
                    pendingICSContent = content;
                    String segment = uri.getLastPathSegment();
                    if (segment != null && !segment.isEmpty()) {
                        pendingICSFileName = segment;
                    }
                    dispatchICSToWebView();
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Erreur lecture fichier ICS depuis intent Android", e);
        }
    }

    private void dispatchICSToWebView() {
        if (pendingICSContent == null) return;

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;

        final String content = pendingICSContent;
        final String fileName = pendingICSFileName;

        webView.post(new Runnable() {
            @Override
            public void run() {
                try {
                    String quotedContent = JSONObject.quote(content);
                    String quotedName = JSONObject.quote(fileName);

                    String js = "(function() {" +
                        "  try {" +
                        "    var text = " + quotedContent + ";" +
                        "    var name = " + quotedName + ";" +
                        "    sessionStorage.setItem('dar_pending_ics_content', text);" +
                        "    sessionStorage.setItem('dar_pending_ics_name', name);" +
                        "    window.dispatchEvent(new CustomEvent('dar:open-ics', { detail: { content: text, name: name } }));" +
                        "    if (window.location.pathname !== '/agenda') {" +
                        "      window.location.href = '/agenda?import_ics=1';" +
                        "    }" +
                        "  } catch(e) { console.error('Erreur dispatch ICS frontend:', e); }" +
                        "})();";

                    webView.evaluateJavascript(js, null);
                    pendingICSContent = null;
                } catch (Exception e) {
                    Log.e(TAG, "Erreur evaluateJavascript pour ICS", e);
                }
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        if (pendingICSContent != null) {
            dispatchICSToWebView();
        }
    }
}
