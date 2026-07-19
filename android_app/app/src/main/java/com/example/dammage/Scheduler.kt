package com.example.dammage

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object Scheduler {
    const val MANUAL_WORK_NAME = "damage_capture_manual"

    private const val WORK_NAME = "damage_capture_work"
    private const val IMMEDIATE_WORK_NAME = "damage_capture_immediate"

    fun schedule(ctx: Context, intervalMinutes: Long) {
        val minutes = intervalMinutes.coerceAtLeast(15L)
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        // Periodic waits one full interval before first run,
        // so it does NOT collide with the immediate OneTime.
        val periodic = PeriodicWorkRequestBuilder<CaptureWorker>(
            minutes,
            TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .setInitialDelay(minutes, TimeUnit.MINUTES)
            .setBackoffCriteria(BackoffPolicy.LINEAR, 5, TimeUnit.MINUTES)
            .build()

        val immediate = OneTimeWorkRequestBuilder<CaptureWorker>()
            .setConstraints(constraints)
            .build()

        Prefs(ctx).scheduledAt = System.currentTimeMillis()

        val wm = WorkManager.getInstance(ctx)
        wm.enqueueUniqueWork(IMMEDIATE_WORK_NAME, ExistingWorkPolicy.REPLACE, immediate)
        wm.enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            periodic
        )
    }

    fun cancel(ctx: Context) {
        val wm = WorkManager.getInstance(ctx)
        wm.cancelUniqueWork(WORK_NAME)
        wm.cancelUniqueWork(IMMEDIATE_WORK_NAME)
    }

    fun captureOnce(ctx: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val once = OneTimeWorkRequestBuilder<CaptureWorker>()
            .setConstraints(constraints)
            .build()
        WorkManager.getInstance(ctx).enqueueUniqueWork(
            MANUAL_WORK_NAME,
            ExistingWorkPolicy.KEEP,
            once
        )
    }
}
