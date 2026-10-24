package de.opensprachfuchs.app

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import java.time.LocalDate
import java.util.Calendar

/**
 * Daily reminder: once a day at the chosen time the app checks whether a round was finished today.
 * If not, it posts a notification. Works without the WebView running; the page only reports its state.
 */
object Reminders {
    private const val PREFS = "reminder"
    private const val CHANNEL = "daily"
    const val ACTION = "de.opensprachfuchs.app.REMINDER"

    private fun prefs(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun save(c: Context, on: Boolean, hour: Int, minute: Int) {
        prefs(c).edit().putBoolean("on", on).putInt("hour", hour).putInt("minute", minute).apply()
        schedule(c)
    }

    fun report(c: Context, lastDay: String, streak: Int) {
        prefs(c).edit().putString("lastDay", lastDay).putInt("streak", streak).apply()
        StreakWidget.updateAll(c)
    }

    /** The last learning day (yyyy-MM-dd, "" if none) and the streak, as the page last reported them. */
    fun state(c: Context): Pair<String, Int> = prefs(c).let { it.getString("lastDay", "") .orEmpty() to it.getInt("streak", 0) }

    /** (Re)arms the daily alarm; inexact, so no special alarm permission is needed. */
    fun schedule(c: Context) {
        val p = prefs(c)
        val am = c.getSystemService(AlarmManager::class.java) ?: return
        val pi = PendingIntent.getBroadcast(
            c, 1, Intent(c, ReminderReceiver::class.java).setAction(ACTION),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        am.cancel(pi)
        if (!p.getBoolean("on", false)) return
        val at = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, p.getInt("hour", 19))
            set(Calendar.MINUTE, p.getInt("minute", 0))
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
        }
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, at.timeInMillis, AlarmManager.INTERVAL_DAY, pi)
    }

    fun notifyIfOpen(c: Context) {
        val p = prefs(c)
        if (!p.getBoolean("on", false)) return
        if (p.getString("lastDay", "") == LocalDate.now().toString()) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val nm = c.getSystemService(NotificationManager::class.java) ?: return
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Tägliche Erinnerung", NotificationManager.IMPORTANCE_DEFAULT))
        val streak = p.getInt("streak", 0)
        val text = if (streak > 0) "Deine Serie von $streak ${if (streak == 1) "Tag" else "Tagen"} wartet. Eine Lektion reicht!"
        else "Fünf Minuten OpenSprachFuchs? Eine Lektion reicht fürs Tagesziel."
        val open = PendingIntent.getActivity(
            c, 0, Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val n = Notification.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Zeit für OpenSprachFuchs")
            .setContentText(text)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        nm.notify(1, n)
    }
}

/** Receives the daily alarm, and re-arms it after the phone restarts. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED -> Reminders.schedule(context)
            Reminders.ACTION -> Reminders.notifyIfOpen(context)
        }
    }
}
