package com.r3mc10.roadsofthenorth;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Bundle;
import java.io.File;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UpdaterPlugin.class);   // our own in-app updater
        guardGameUpdate();
        super.onCreate(savedInstanceState);
    }

    /** If downloaded game files failed to start three times in a row (the game never reached its title screen), remember
        that build as bad and go back to the last downloaded build that worked; failing that, to the files inside the app. */
    private void guardGameUpdate() {
        try {
            SharedPreferences cap = getSharedPreferences(UpdaterPlugin.CAP_PREFS, Context.MODE_PRIVATE);
            String path = cap.getString(UpdaterPlugin.CAP_PATH, "");
            if (path == null || path.isEmpty()) return;
            SharedPreferences ota = getSharedPreferences(UpdaterPlugin.OTA_PREFS, Context.MODE_PRIVATE);
            int trial = ota.getInt("trial", 0) + 1;
            if (trial < 3 && new File(path, "index.html").exists()) { ota.edit().putInt("trial", trial).commit(); return; }
            long badBuild = ota.getLong("gameBuild", 0L);
            String bad = ota.getString("bad", "");
            if (badBuild > 0) {
                bad = bad == null || bad.isEmpty() ? String.valueOf(badBuild) : bad + "," + badBuild;
                String[] parts = bad.split(",");
                if (parts.length > 10) {   // keep the last ten
                    StringBuilder sb = new StringBuilder();
                    for (int i = parts.length - 10; i < parts.length; i++) { if (sb.length() > 0) sb.append(','); sb.append(parts[i]); }
                    bad = sb.toString();
                }
            }
            String good = ota.getString("goodPath", "");
            long goodBuild = ota.getLong("goodBuild", 0L);
            long apk = 0;
            try {
                PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
                apk = Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
            } catch (Exception e) { /* unknown: go back to the app's own files */ }
            SharedPreferences.Editor o = ota.edit().putInt("trial", 0).putString("bad", bad);
            if (good != null && !good.isEmpty() && !good.equals(path) && apk > 0 && goodBuild > apk && new File(good, "index.html").exists()) {
                cap.edit().putString(UpdaterPlugin.CAP_PATH, good).commit();
                o.putLong("gameBuild", goodBuild).commit();
            } else {
                cap.edit().remove(UpdaterPlugin.CAP_PATH).commit();
                o.putLong("gameBuild", 0L).remove("goodPath").remove("goodBuild").commit();
            }
        } catch (Exception e) { /* never block starting the game */ }
    }
}
