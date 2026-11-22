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

import android.content.Context;
import android.content.SharedPreferences;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
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
    /** Bump when the native side changes in a way new game files depend on. Game-only updates
        (game-shellN.zip with N <= SHELL) install in the background with no Android installer. */
    public static final int SHELL = 2;
    static final String OTA_PREFS = "rotn_ota";
    static final String CAP_PREFS = "CapWebViewSettings", CAP_PATH = "serverBasePath";
    private volatile boolean busy = false;

    @PluginMethod
    public void info(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            PackageManager pm = getContext().getPackageManager();
            PackageInfo pi = pm.getPackageInfo(getContext().getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
            long game = getContext().getSharedPreferences(OTA_PREFS, Context.MODE_PRIVATE).getLong("gameBuild", 0L);
            String path = getContext().getSharedPreferences(CAP_PREFS, Context.MODE_PRIVATE).getString(CAP_PATH, "");
            boolean onGame = path != null && !path.isEmpty() && new File(path).exists();
            ret.put("apkBuild", code);
            ret.put("build", onGame && game > code ? game : code);
            ret.put("version", pi.versionName);
        } catch (Exception e) {
            ret.put("build", 0);
        }
        ret.put("canInstall", canInstall());
        ret.put("shell", SHELL);
        call.resolve(ret);
    }

    /** the game started fine on the current files: stop counting failed starts */
    @PluginMethod
    public void gameReady(PluginCall call) {
        getContext().getSharedPreferences(OTA_PREFS, Context.MODE_PRIVATE).edit().putInt("trial", 0).apply();
        call.resolve();
    }

    /** downloads game-shellN.zip, unpacks it next to the app's data and returns its folder */
    @PluginMethod
    public void downloadGame(PluginCall call) {
        final String url = call.getString("url");
        final long expected = call.getLong("size", 0L);
        final long build = call.getLong("build", 0L);
        if (url == null || !isAllowed(url) || build <= 0) { call.reject("Not an update address"); return; }
        if (busy) { call.reject("Already downloading"); return; }
        busy = true;
        new Thread(() -> {
            File zip = new File(new File(getContext().getCacheDir(), "updates"), "game.zip");
            File root = new File(getContext().getFilesDir(), "ota");
            File dest = new File(root, "build-" + build), tmp = new File(root, "build-" + build + ".part");
            try {
                fetch(url, expected, zip);
                deleteTree(tmp);
                tmp.mkdirs();
                String base = tmp.getCanonicalPath() + File.separator;
                try (ZipInputStream zin = new ZipInputStream(new FileInputStream(zip))) {
                    ZipEntry e; byte[] buf = new byte[64 * 1024];
                    while ((e = zin.getNextEntry()) != null) {
                        File out = new File(tmp, e.getName());
                        if (!out.getCanonicalPath().startsWith(base)) throw new Exception("Bad file in update");
                        if (e.isDirectory()) { out.mkdirs(); continue; }
                        out.getParentFile().mkdirs();
                        try (OutputStream o = new FileOutputStream(out)) { int n; while ((n = zin.read(buf)) > 0) o.write(buf, 0, n); }
                    }
                }
                if (!new File(tmp, "index.html").exists()) throw new Exception("Update is missing the game");
                deleteTree(dest);
                if (!tmp.renameTo(dest)) throw new Exception("Couldn't save the update");
                zip.delete();
                // tidy older unpacked builds, keeping the one in use
                String inUse = getContext().getSharedPreferences(CAP_PREFS, Context.MODE_PRIVATE).getString(CAP_PATH, "");
                File[] old = root.listFiles();
                if (old != null) for (File f : old) if (!f.equals(dest) && !f.getAbsolutePath().equals(inUse)) deleteTree(f);
                JSObject ret = new JSObject();
                ret.put("path", dest.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception ex) {
                deleteTree(tmp);
                zip.delete();
                call.reject(ex.getMessage() == null ? "Download failed" : ex.getMessage());
            } finally {
                busy = false;
            }
        }).start();
    }

    /** switches the game to unpacked files; now=true reloads at once, otherwise next start */
    @PluginMethod
    public void applyGame(PluginCall call) {
        final String path = call.getString("path");
        final long build = call.getLong("build", 0L);
        final boolean now = Boolean.TRUE.equals(call.getBoolean("now", false));
        try {
            File dir = new File(path == null ? "" : path);
            File root = new File(getContext().getFilesDir(), "ota");
            if (!dir.getCanonicalPath().startsWith(root.getCanonicalPath() + File.separator) || !new File(dir, "index.html").exists()) { call.reject("No such update"); return; }
            getContext().getSharedPreferences(CAP_PREFS, Context.MODE_PRIVATE).edit().putString(CAP_PATH, dir.getAbsolutePath()).apply();
            getContext().getSharedPreferences(OTA_PREFS, Context.MODE_PRIVATE).edit().putLong("gameBuild", build).putInt("trial", 0).apply();
            call.resolve();
            if (now) getActivity().runOnUiThread(() -> getBridge().setServerBasePath(dir.getAbsolutePath()));
        } catch (Exception e) {
            call.reject("Couldn't switch to the update: " + e.getMessage());
        }
    }

    static void deleteTree(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteTree(k);
        f.delete();
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
            try {
                fetch(url, expected, new File(new File(getContext().getCacheDir(), "updates"), "update.apk"));
                JSObject ret = new JSObject();
                ret.put("ok", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "Download failed" : e.getMessage());
            } finally {
                busy = false;
            }
        }).start();
    }

    /** https download (following GitHub's redirects) into done, via a .part file; reports "progress" */
    private void fetch(String url, long expected, File done) throws Exception {
        HttpURLConnection conn = null;
        File dir = done.getParentFile(), part = new File(dir, done.getName() + ".part");
        try {
            dir.mkdirs();
            part.delete();
            URL u = new URL(url);
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
            if (!part.renameTo(done)) throw new Exception("Couldn't save the download");
        } catch (Exception e) {
            part.delete();
            throw e;
        } finally {
            if (conn != null) conn.disconnect();
        }
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
