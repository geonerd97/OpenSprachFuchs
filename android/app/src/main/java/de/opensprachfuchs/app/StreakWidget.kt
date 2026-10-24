package de.opensprachfuchs.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import java.time.LocalDate

/**
 * Home-screen widget with the fox, the current streak and whether today's goal is done.
 * The data comes from the page via AndroidBridge.reportDay (stored by [Reminders]); the widget refreshes when that
 * happens and every 30 minutes, so the change of day shows up without opening the app.
 */
class StreakWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) manager.updateAppWidget(id, views(context))
    }

    companion object {
        fun updateAll(c: Context) {
            val manager = AppWidgetManager.getInstance(c)
            val ids = manager.getAppWidgetIds(ComponentName(c, StreakWidget::class.java))
            if (ids.isNotEmpty()) for (id in ids) manager.updateAppWidget(id, views(c))
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
