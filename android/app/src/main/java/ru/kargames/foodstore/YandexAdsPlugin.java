package ru.kargames.foodstore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yandex.mobile.ads.common.AdError;
import com.yandex.mobile.ads.common.AdRequest;
import com.yandex.mobile.ads.common.AdRequestError;
import com.yandex.mobile.ads.common.ImpressionData;
import com.yandex.mobile.ads.common.YandexAds;
import com.yandex.mobile.ads.interstitial.InterstitialAd;
import com.yandex.mobile.ads.interstitial.InterstitialAdEventListener;
import com.yandex.mobile.ads.interstitial.InterstitialAdLoadListener;
import com.yandex.mobile.ads.interstitial.InterstitialAdLoader;
import com.yandex.mobile.ads.rewarded.Reward;
import com.yandex.mobile.ads.rewarded.RewardedAd;
import com.yandex.mobile.ads.rewarded.RewardedAdEventListener;
import com.yandex.mobile.ads.rewarded.RewardedAdLoadListener;
import com.yandex.mobile.ads.rewarded.RewardedAdLoader;

/*
 * Yandex Mobile Ads для APK: межстраничная и вознаграждаемая.
 *
 * Игра зовёт это из prototype/src/ysdk.js (window.Capacitor.Plugins.YandexAds)
 * через те же interstitial()/rewarded(), что и SDK Яндекс Игр в браузере, —
 * код игры про площадку не знает.
 *
 * Оба блока грузятся заранее и перезагружаются сразу после показа: иначе
 * между сменами игрок ждал бы загрузку ролика секунду-другую.
 */
@CapacitorPlugin(name = "YandexAds")
public class YandexAdsPlugin extends Plugin {

    // Боевые блоки из кабинета Рекламной сети. Для отладки без показов в
    // статистику — demo-interstitial-yandex / demo-rewarded-yandex.
    // Награда в кабинете («Reward», 1) игрой не читается: что выдать, решает
    // game.js, SDK нужен только факт onRewarded.
    static final String INTERSTITIAL_ID = "R-M-20097246-1";
    static final String REWARDED_ID = "R-M-20097246-2";

    private InterstitialAdLoader interstitialLoader;
    private RewardedAdLoader rewardedLoader;
    private InterstitialAd interstitial;
    private RewardedAd rewarded;

    @Override
    public void load() {
        YandexAds.initialize(getContext(), () -> {});
        interstitialLoader = new InterstitialAdLoader(getContext());
        rewardedLoader = new RewardedAdLoader(getContext());
        loadInterstitial();
        loadRewarded();
    }

    private void loadInterstitial() {
        interstitialLoader.loadAd(new AdRequest.Builder(INTERSTITIAL_ID).build(), new InterstitialAdLoadListener() {
            @Override public void onAdLoaded(InterstitialAd ad) { interstitial = ad; }
            @Override public void onAdFailedToLoad(AdRequestError error) { interstitial = null; }
        });
    }

    private void loadRewarded() {
        rewardedLoader.loadAd(new AdRequest.Builder(REWARDED_ID).build(), new RewardedAdLoadListener() {
            @Override public void onAdLoaded(RewardedAd ad) { rewarded = ad; }
            @Override public void onAdFailedToLoad(AdRequestError error) { rewarded = null; }
        });
    }

    private static JSObject result(String key, boolean value) {
        JSObject r = new JSObject();
        r.put(key, value);
        return r;
    }

    /** Ответ { shown }: false — блок не загружен или не показался, игра идёт дальше. */
    @PluginMethod
    public void showInterstitial(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            InterstitialAd ad = interstitial;
            if (ad == null) {
                loadInterstitial();
                call.resolve(result("shown", false));
                return;
            }
            interstitial = null;
            ad.setAdEventListener(new InterstitialAdEventListener() {
                boolean shown;
                @Override public void onAdShown() { shown = true; }
                @Override public void onAdFailedToShow(AdError error) { done(); }
                @Override public void onAdDismissed() { done(); }
                @Override public void onAdClicked() {}
                @Override public void onAdImpression(ImpressionData data) {}
                private void done() {
                    loadInterstitial();
                    call.resolve(result("shown", shown));
                }
            });
            ad.show(getActivity());
        });
    }

    /** Ответ { rewarded }: true только если SDK прислал onRewarded (досмотрено). */
    @PluginMethod
    public void showRewarded(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            RewardedAd ad = rewarded;
            if (ad == null) {
                loadRewarded();
                call.resolve(result("rewarded", false));
                return;
            }
            rewarded = null;
            ad.setAdEventListener(new RewardedAdEventListener() {
                boolean paid;
                @Override public void onAdShown() {}
                @Override public void onAdFailedToShow(AdError error) { done(); }
                @Override public void onAdDismissed() { done(); }
                @Override public void onAdClicked() {}
                @Override public void onAdImpression(ImpressionData data) {}
                @Override public void onRewarded(Reward reward) { paid = true; }
                private void done() {
                    loadRewarded();
                    call.resolve(result("rewarded", paid));
                }
            });
            ad.show(getActivity());
        });
    }
}
