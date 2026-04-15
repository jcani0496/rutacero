package com.rutacero.app;

import com.getcapacitor.BridgeActivity;
import com.rutacero.app.billing.GooglePlayBillingPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(GooglePlayBillingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
