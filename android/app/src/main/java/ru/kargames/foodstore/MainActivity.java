package ru.kargames.foodstore;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.my.tracker.MyTracker;

public class MainActivity extends BridgeActivity {

    // SDK-ключ приложения из кабинета MyTracker (вкладка «Обзор»).
    static final String MYTRACKER_SDK_KEY = "38967821712940735104";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Своего Application у Capacitor нет, поэтому по доке MyTracker —
        // инициализация в первой активности и запуск отмечается вручную.
        // До super.onCreate: плагины моста грузятся там и уже могут слать события.
        MyTracker.initTracker(MYTRACKER_SDK_KEY, getApplication());
        MyTracker.trackLaunchManually(this);

        // локальные плагины регистрируются до super.onCreate, иначе мост их не увидит
        registerPlugin(YandexAdsPlugin.class);
        registerPlugin(MyTrackerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
