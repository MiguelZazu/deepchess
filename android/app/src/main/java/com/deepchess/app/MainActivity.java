package com.deepchess.app;

import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Serve the bundled app "cross-origin isolated" (COOP + COEP) so the multi-threaded
        // Stockfish build can use SharedArrayBuffer and all CPU cores. Only the responses of the
        // app's own local server (its bundled files) are touched; the local server returns null
        // for any other URL, which then goes to the network unchanged.
        bridge.setWebViewClient(
            new BridgeWebViewClient(bridge) {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    WebResourceResponse res = super.shouldInterceptRequest(view, request);
                    if (res != null) {
                        Map<String, String> headers = new HashMap<>();
                        if (res.getResponseHeaders() != null) headers.putAll(res.getResponseHeaders());
                        headers.put("Cross-Origin-Opener-Policy", "same-origin");
                        headers.put("Cross-Origin-Embedder-Policy", "credentialless");
                        res.setResponseHeaders(headers);
                    }
                    return res;
                }
            }
        );
    }
}
