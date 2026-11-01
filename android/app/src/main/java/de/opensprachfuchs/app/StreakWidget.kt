package de.opensprachfuchs.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import java.time.LocalDate
import java.util.Calendar

/**
 * Home-screen widget with the fox, the current streak and whether today's goal is done.
 * The data comes from the page via AndroidBridge.reportDay (stored by [Reminders]); the widget refreshes when that
 * happens, when the app comes to the front, after a restart and right after midnight.
 */
class StreakWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) manager.updateAppWidget(id, views(context))
        scheduleMidnight(context)
    }

    override fun onEnabled(context: Context) = scheduleMidnight(context)

    override fun onDisabled(context: Context) {
        val am = context.getSystemService(AlarmManager::class.java) ?: return
        am.cancel(midnightIntent(context))
    }

    companion object {
        fun updateAll(c: Context) {
            val manager = AppWidgetManager.getInstance(c)
            val ids = manager.getAppWidgetIds(ComponentName(c, StreakWidget::class.java))
            if (ids.isEmpty()) return
            for (id in ids) manager.updateAppWidget(id, views(c))
            scheduleMidnight(c)
        }

        /**
         * The text says whether today's goal is done, so it is wrong from midnight on until something redraws it.
         * android:updatePeriodMillis never wakes the device and is throttled, so the widget kept yesterday's
         * "Tagesziel geschafft ✓" (issue #24). An inexact daily alarm just after midnight redraws it instead.
         */
        fun scheduleMidnight(c: Context) {
            val am = c.getSystemService(AlarmManager::class.java) ?: return
            val at = Calendar.getInstance().apply {
                add(Calendar.DAY_OF_YEAR, 1)
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 5)
                set(Calendar.MILLISECOND, 0)
            }
            am.setInexactRepeating(AlarmManager.RTC, at.timeInMillis, AlarmManager.INTERVAL_DAY, midnightIntent(c))
        }

        private fun midnightIntent(c: Context): PendingIntent {
            val ids = AppWidgetManager.getInstance(c).getAppWidgetIds(ComponentName(c, StreakWidget::class.java))
            val i = Intent(c, StreakWidget::class.java)
                .setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            return PendingIntent.getBroadcast(c, 3, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }

        private fun views(c: Context): RemoteViews {
            val (lastDay, reported) = Reminders.state(c)
            val today = LocalDate.now()
            val learnedToday = lastDay == today.toString()
            // The streak only counts while the last learning day is today or yesterday.
            val streak = if (learnedToday || lastDay == today.minusDays(1).toString()) reported else 0
            val v = RemoteViews(c.packageName, R.layout.widget_streak)
            v.setTextViewText(R.id.widget_streak, if (streak > 0) "🔥 $streak ${if (streak == 1) "Tag" else "Tage"}" else "🦊 Los geht's")
            v.setTextViewText(
                R.id.widget_status,
                when {
                    learnedToday -> "Tagesziel geschafft ✓"
                    streak > 0 -> "Heute noch eine Lektion!"
                    else -> "Starte heute eine Serie"
                }
            )
            val open = PendingIntent.getActivity(
                c, 2, Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            v.setOnClickPendingIntent(R.id.widget_root, open)
            return v
        }
    }
}
