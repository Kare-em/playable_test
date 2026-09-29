package ru.kargames.foodstore;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // локальный плагин регистрируется до super.onCreate, иначе мост его не увидит
        registerPlugin(YandexAdsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
