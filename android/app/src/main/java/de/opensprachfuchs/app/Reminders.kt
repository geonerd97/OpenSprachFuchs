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
    const val MIDNIGHT = "de.opensprachfuchs.app.MIDNIGHT"

    private fun prefs(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun save(c: Context, on: Boolean, hour: Int, minute: Int) {
        prefs(c).edit().putBoolean("on", on).putInt("hour", hour).putInt("minute", minute).apply()
        schedule(c)
    }

    /** Switches the reminder off again, e.g. after the notification permission was denied. */
    fun turnOff(c: Context) {
        prefs(c).edit().putBoolean("on", false).apply()
        schedule(c)
    }

    /** [until]: the last day (yyyy-MM-dd) on which the streak still holds without learning, streak freezes included. */
    fun report(c: Context, lastDay: String, streak: Int, until: String) {
        prefs(c).edit().putString("lastDay", lastDay).putInt("streak", streak).putString("until", until).apply()
        StreakWidget.updateAll(c)
    }

    /** Whether a round was finished today, and the streak that still counts today (0 once it has lapsed). */
    data class Streak(val learnedToday: Boolean, val days: Int)

    /** The streak as of today, from what the page last reported. Shared by the widget and the reminder (issues #44, #45). */
    fun streak(c: Context, today: LocalDate = LocalDate.now()): Streak {
        val p = prefs(c)
        val lastDay = p.getString("lastDay", "").orEmpty()
        val learnedToday = lastDay == today.toString()
        // The page reports until when the streak holds (streak freezes cover missed days); without that report
        // (an older page) it only counts while the last learning day is today or yesterday.
        val until = p.getString("until", null)?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
            ?: runCatching { LocalDate.parse(lastDay).plusDays(1) }.getOrNull()
        val holds = learnedToday || (until != null && !today.isAfter(until))
        return Streak(learnedToday, if (holds) p.getInt("streak", 0) else 0)
    }

    /* The widget says whether today's goal is done, so it has to be redrawn when the date changes. Its periodic
       update (30 min) does not run while the phone dozes through the night, and ACTION_DATE_CHANGED may not be
       received from the manifest since Android 8. So an alarm at midnight redraws it (issue #24). */
    private fun midnightIntent(c: Context) = PendingIntent.getBroadcast(
        c, 2, Intent(c, ReminderReceiver::class.java).setAction(MIDNIGHT),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    fun scheduleMidnight(c: Context) {
        val am = c.getSystemService(AlarmManager::class.java) ?: return
        val at = Calendar.getInstance().apply {
            add(Calendar.DAY_OF_YEAR, 1)
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 5); set(Calendar.MILLISECOND, 0)
        }
        val pi = midnightIntent(c)
        am.cancel(pi)
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, at.timeInMillis, AlarmManager.INTERVAL_DAY, pi)
    }

    fun cancelMidnight(c: Context) {
        c.getSystemService(AlarmManager::class.java)?.cancel(midnightIntent(c))
    }

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
        val now = streak(c)
        if (now.learnedToday) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val nm = c.getSystemService(NotificationManager::class.java) ?: return
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Tägliche Erinnerung", NotificationManager.IMPORTANCE_DEFAULT))
        val streak = now.days // a lapsed streak is not named (issue #45)
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

/** Receives the daily alarm and the one at midnight, and re-arms both after a restart or a change of time. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED -> {
                Reminders.schedule(context)
                Reminders.scheduleMidnight(context)
                StreakWidget.updateAll(context) // the date may have jumped
            }
            Reminders.ACTION -> Reminders.notifyIfOpen(context)
            Reminders.MIDNIGHT -> StreakWidget.updateAll(context)
        }
    }
}
