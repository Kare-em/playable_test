package ru.kargames.foodstore;

import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yandex.mobile.ads.banner.BannerAdEventListener;
import com.yandex.mobile.ads.banner.BannerAdSize;
import com.yandex.mobile.ads.banner.BannerAdView;
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
 * Yandex Mobile Ads для APK: межстраничная, вознаграждаемая и sticky-баннер.
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

    // Боевые блоки из кабинета Рекламной сети — свои у RuStore и Google Play,
    // задаются флейвором в app/build.gradle. Для отладки без показов в
    // статистику — demo-interstitial-yandex / demo-rewarded-yandex / demo-banner-yandex.
    // Награда в кабинете («Reward», 1) игрой не читается: что выдать, решает
    // game.js, SDK нужен только факт onRewarded.
    static final String INTERSTITIAL_ID = BuildConfig.AD_INTERSTITIAL;
    static final String REWARDED_ID = BuildConfig.AD_REWARDED;
    static final String BANNER_ID = BuildConfig.AD_BANNER;

    // Не загрузился баннер — пробуем снова через полминуты, не долбим сеть.
    static final long BANNER_RETRY_MS = 30000;

    private InterstitialAdLoader interstitialLoader;
    private RewardedAdLoader rewardedLoader;
    private InterstitialAd interstitial;
    private RewardedAd rewarded;

    // Sticky-баннер только на экране магазина (GDD §5: «не в геймплее»).
    // Висит под WebView, а не поверх: WebView на время показа укорачивается,
    // игра получает resize и раскладывает магазин выше баннера.
    private BannerAdView banner;
    private boolean bannerWanted, bannerLoaded, bannerShown;
    private int webBottomMargin;

    @Override
    public void load() {
        YandexAds.initialize(getContext(), () -> {});
        interstitialLoader = new InterstitialAdLoader(getContext());
        rewardedLoader = new RewardedAdLoader(getContext());
        loadInterstitial();
        loadRewarded();
        getActivity().runOnUiThread(this::createBanner);
    }

    private void createBanner() {
        android.util.DisplayMetrics dm = getContext().getResources().getDisplayMetrics();
        int widthDp = Math.round(Math.min(dm.widthPixels, dm.heightPixels) / dm.density);
        banner = new BannerAdView(getContext());
        banner.setAdSize(BannerAdSize.sticky(getContext(), widthDp));
        banner.setVisibility(View.GONE);
        banner.setBannerAdEventListener(new BannerAdEventListener() {
            @Override public void onAdLoaded() { bannerLoaded = true; applyBanner(); }
            @Override public void onAdFailedToLoad(AdRequestError error) {
                bannerLoaded = false;
                applyBanner();
                banner.postDelayed(() -> loadBanner(), BANNER_RETRY_MS);
            }
            @Override public void onAdClicked() {}
            @Override public void onImpression(ImpressionData data) {}
        });
        loadBanner();
    }

    private void loadBanner() {
        if (banner != null) banner.loadAd(new AdRequest.Builder(BANNER_ID).build());
    }

    /** Показать/спрятать по bannerWanted && bannerLoaded. Только с UI-потока. */
    private void applyBanner() {
        if (banner == null) return;
        boolean show = bannerWanted && bannerLoaded;
        if (show == bannerShown) return;
        View web = getBridge().getWebView();
        ViewGroup.MarginLayoutParams wlp = (ViewGroup.MarginLayoutParams) web.getLayoutParams();
        if (show) {
            if (banner.getParent() == null) {
                ViewGroup content = getActivity().findViewById(android.R.id.content);
                content.addView(banner, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT,
                    Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL));
            }
            // targetSdk 36 = edge-to-edge: без отступа баннер уйдёт под навигацию
            int nav = 0;
            WindowInsetsCompat ins = ViewCompat.getRootWindowInsets(web);
            if (ins != null) nav = ins.getInsets(WindowInsetsCompat.Type.systemBars()).bottom;
            ((FrameLayout.LayoutParams) banner.getLayoutParams()).bottomMargin = nav;
            banner.setVisibility(View.VISIBLE);
            banner.requestLayout();
            int h = banner.getAdSize() != null ? banner.getAdSize().getHeightInPixels(getContext()) : 0;
            webBottomMargin = wlp.bottomMargin;
            wlp.bottomMargin = Math.max(webBottomMargin, nav + h);
        } else {
            banner.setVisibility(View.GONE);
            wlp.bottomMargin = webBottomMargin;
        }
        web.setLayoutParams(wlp);
        bannerShown = show;
    }

    /** Экран магазина открыт — баннер нужен. Повторный вызов ничего не меняет. */
    @PluginMethod
    public void showBanner(PluginCall call) {
        getActivity().runOnUiThread(() -> { bannerWanted = true; applyBanner(); });
        call.resolve();
    }

    @PluginMethod
    public void hideBanner(PluginCall call) {
        getActivity().runOnUiThread(() -> { bannerWanted = false; applyBanner(); });
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (banner != null) banner.destroy();
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
