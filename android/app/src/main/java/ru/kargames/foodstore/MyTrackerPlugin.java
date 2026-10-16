package ru.kargames.foodstore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.my.tracker.MyTracker;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/*
 * Аналитика MyTracker для APK.
 *
 * Сам трекер поднимается в MainActivity (initTracker + trackLaunchManually —
 * установки, запуски и сессии он считает сам). Сюда игра шлёт только свои
 * события через prototype/src/ysdk.js (YGames.track / trackLevel): что и когда
 * отправлять, решает game.js, плагин лишь переводит JSON в Map<String, String>.
 */
@CapacitorPlugin(name = "MyTracker")
public class MyTrackerPlugin extends Plugin {

    // Лимит SDK: имя события, ключ и значение — не длиннее 255 символов.
    private static final int MAX_LEN = 255;

    private static String cut(String s) {
        return s.length() > MAX_LEN ? s.substring(0, MAX_LEN) : s;
    }

    private static Map<String, String> params(PluginCall call) {
        Map<String, String> out = new HashMap<>();
        JSObject p = call.getObject("params");
        if (p == null) return out;
        Iterator<String> keys = p.keys();
        while (keys.hasNext()) {
            String k = keys.next();
            Object v = p.opt(k);
            if (v == null || v == org.json.JSONObject.NULL) continue;
            out.put(cut(k), cut(String.valueOf(v)));
        }
        return out;
    }

    @PluginMethod
    public void trackEvent(PluginCall call) {
        String name = call.getString("name");
        if (name == null || name.isEmpty()) { call.reject("name required"); return; }
        MyTracker.trackEvent(cut(name), params(call));
        call.resolve();
    }

    /** Достигнутый уровень — у MyTracker для него свой отчёт, отдельный от событий. */
    @PluginMethod
    public void trackLevel(PluginCall call) {
        Integer level = call.getInt("level");
        if (level == null) MyTracker.trackLevelEvent(params(call));
        else MyTracker.trackLevelEvent(level, params(call));
        call.resolve();
    }

    @PluginMethod
    public void flush(PluginCall call) {
        MyTracker.flush();
        call.resolve();
    }

    // Буфер SDK отправляется раз в 15 минут, а смена длится пару минут:
    // игрок, свернувший игру после первой смены, иначе дошёл бы до отчёта
    // только при следующем запуске — или никогда, если не вернётся.
    @Override
    protected void handleOnPause() {
        MyTracker.flush();
    }
}
