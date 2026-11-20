package com.r3mc10.roadsofthenorth;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * In-app updater: downloads a new APK from the game's GitHub releases and hands it to
 * Android's installer. Android itself refuses any APK not signed with the same key,
 * so only real builds of this app can ever be installed this way.
 */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {
    private static final String ALLOWED_HOST = "github.com";
    private volatile boolean busy = false;

    @PluginMethod
    public void info(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            PackageManager pm = getContext().getPackageManager();
            PackageInfo pi = pm.getPackageInfo(getContext().getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
            ret.put("build", code);
            ret.put("version", pi.versionName);
        } catch (Exception e) {
            ret.put("build", 0);
        }
        ret.put("canInstall", canInstall());
        call.resolve(ret);
    }

    private boolean canInstall() {
        return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls();
    }

    /** opens the "Install unknown apps" switch for this app */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= 26) {
                i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            } else {
                i = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Couldn't open settings: " + e.getMessage());
        }
    }

    /** downloads the APK to the app's cache, reporting progress as "progress" events */
    @PluginMethod
    public void download(PluginCall call) {
        final String url = call.getString("url");
        final long expected = call.getLong("size", 0L);
        if (url == null || !isAllowed(url)) { call.reject("Not an update address"); return; }
        if (busy) { call.reject("Already downloading"); return; }
        busy = true;
        new Thread(() -> {
            HttpURLConnection conn = null;
            File dir = new File(getContext().getCacheDir(), "updates");
            File part = new File(dir, "update.apk.part"), done = new File(dir, "update.apk");
            try {
                dir.mkdirs();
                part.delete();
                URL u = new URL(url);
                // follow GitHub's redirects to its download servers, https only
                for (int hops = 0; hops < 6; hops++) {
                    conn = (HttpURLConnection) u.openConnection();
                    conn.setInstanceFollowRedirects(false);
                    conn.setConnectTimeout(20000);
                    conn.setReadTimeout(30000);
                    conn.setRequestProperty("Accept", "application/octet-stream");
                    int code = conn.getResponseCode();
                    if (code >= 300 && code < 400) {
                        String loc = conn.getHeaderField("Location");
                        conn.disconnect();
                        if (loc == null) throw new Exception("Bad redirect");
                        u = new URL(u, loc);
                        if (!"https".equals(u.getProtocol())) throw new Exception("Insecure redirect");
                        continue;
                    }
                    if (code != 200) throw new Exception("Server said " + code);
                    break;
                }
                long total = conn.getContentLengthLong();
                if (total <= 0) total = expected;
                try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(part)) {
                    byte[] buf = new byte[64 * 1024];
                    long got = 0; int n, lastPct = -1;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        got += n;
                        int pct = total > 0 ? (int) (got * 100 / total) : -1;
                        if (pct != lastPct) {
                            lastPct = pct;
                            JSObject p = new JSObject();
                            p.put("pct", pct);
                            p.put("bytes", got);
                            notifyListeners("progress", p);
                        }
                    }
                    if (expected > 0 && got != expected) throw new Exception("Download was cut short");
                }
                done.delete();
                if (!part.renameTo(done)) throw new Exception("Couldn't save the update");
                JSObject ret = new JSObject();
                ret.put("ok", true);
                call.resolve(ret);
            } catch (Exception e) {
                part.delete();
                call.reject(e.getMessage() == null ? "Download failed" : e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
                busy = false;
            }
        }).start();
    }

    /** opens Android's installer for the downloaded APK */
    @PluginMethod
    public void install(PluginCall call) {
        File f = new File(new File(getContext().getCacheDir(), "updates"), "update.apk");
        if (!f.exists()) { call.reject("Download the update first"); return; }
        if (!canInstall()) { call.reject("NEEDS_PERMISSION"); return; }
        try {
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Couldn't open the installer: " + e.getMessage());
        }
    }

    private boolean isAllowed(String url) {
        try {
            URL u = new URL(url);
            return "https".equals(u.getProtocol()) && (ALLOWED_HOST.equals(u.getHost()) || u.getHost().endsWith(".github.com"));
        } catch (Exception e) {
            return false;
        }
    }
}
