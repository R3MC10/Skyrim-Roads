package com.r3mc10.roadsofthenorth;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UpdaterPlugin.class);   // our own in-app updater
        guardGameUpdate();
        super.onCreate(savedInstanceState);
    }

    /** If downloaded game files failed to start three times in a row, go back to the files inside the app. */
    private void guardGameUpdate() {
        try {
            SharedPreferences cap = getSharedPreferences(UpdaterPlugin.CAP_PREFS, Context.MODE_PRIVATE);
            String path = cap.getString(UpdaterPlugin.CAP_PATH, "");
            if (path == null || path.isEmpty()) return;
            SharedPreferences ota = getSharedPreferences(UpdaterPlugin.OTA_PREFS, Context.MODE_PRIVATE);
            int trial = ota.getInt("trial", 0) + 1;
            if (trial >= 3 || !new java.io.File(path, "index.html").exists()) {
                cap.edit().remove(UpdaterPlugin.CAP_PATH).commit();
                ota.edit().putInt("trial", 0).putLong("gameBuild", 0L).commit();
            } else {
                ota.edit().putInt("trial", trial).commit();
            }
        } catch (Exception e) { /* never block starting the game */ }
    }
}
