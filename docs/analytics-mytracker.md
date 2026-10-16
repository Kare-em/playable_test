# Аналитика APK — MyTracker

SDK `com.my.tracker:mytracker-sdk:3.6.0`, ключ в `MainActivity.MYTRACKER_SDK_KEY`.
Установки, запуски, сессии и retention SDK считает сам. Игровые события шлёт
`game.js` → `YGames.track` (`ysdk.js`) → `MyTrackerPlugin.java`. На Яндекс Играх
и в плейтесте вызовы молча пропадают — там нет моста Capacitor.

Буфер SDK уходит раз в 15 минут и принудительно — когда игра сворачивается
(`handleOnPause → flush`). Значит, в кабинете события видны не мгновенно.

## Воронка (каждый шаг — один раз за установку)

| Событие | Когда |
|---|---|
| `funnel_01_launch` | игра загрузилась |
| `funnel_02_first_move` | первый товар выложен |
| `funnel_03_first_order` | первый заказ покупателя закрыт |
| `funnel_04_shift1_end` | первая смена закончилась (любым исходом) |
| `funnel_05_shift1_won` | первая смена выиграна |
| `funnel_06_shop` | первый заход в магазин улучшений |
| `funnel_07_first_upgrade` | первая покупка улучшения |
| `funnel_08_shift2_won` … `funnel_12_shift20_won` | выиграны смены 2, 3, 5, 10, 20 |
| `funnel_first_ad_reward` | первая награда за ролик (вне линейной воронки) |

У всех шагов параметр `build` — метка сборки, чтобы сравнивать версии.
Отметки хранятся в `localStorage['shopsort.funnel']` и не сбрасываются ни
сбросом прогресса, ни новой сборкой.

**В кабинете:** Отчёты → Воронки → шаги `funnel_01_launch` → `funnel_02_first_move`
→ … в порядке номеров. Достигнутые смены дополнительно идут в стандартный
отчёт «Уровни» (`trackLevelEvent(N)`: N — номер смены, до которой дошёл игрок).

## Подробные события (на каждое повторение)

| Событие | Параметры |
|---|---|
| `boot` | `build`, `w`, `h`, `dpr` |
| `shift_start` | `shift`, `goal`, `tray`, `belt`, `patience`, `streak` |
| `shift_end` | `shift`, `status` (won/lost), `why` (impatient/tray_full/no_stock/stuck), `revenue`, `served`, `goal`, `lost`, `combo`, `streak`, `moves`, `home`, `denyFull`, `denyZone`, `spoiled`, `writeOff`, `sec` |
| `booster` | `kind` (undo/fridge/shuffle), `shift`, `move`, `filled`, … |
| `upgrade` | `id`, `level`, `price`, `wallet` |
| `retry` | `shift`, `byAd` |
| `ad_interstitial` | `shift` — показана полноэкранная |
| `ad_rewarded` | `shift`, `paid` — ролик открыт, досмотрен ли |
| `ad_reward` | `kind` (double/boosters) — награда выдана |

Значения уходят строками (лимит SDK — 255 символов). Вложенные поля журнала
(`up`) и текст причины на языке игрока (`reason`) не отправляются.
