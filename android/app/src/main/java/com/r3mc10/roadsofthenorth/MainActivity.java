package com.r3mc10.roadsofthenorth;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UpdaterPlugin.class);   // our own in-app updater
        super.onCreate(savedInstanceState);
    }
}
