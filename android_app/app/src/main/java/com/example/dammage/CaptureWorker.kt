package com.example.dammage

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class CaptureWorker(
    private val appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        Log.i(TAG, "Worker started")
        runCatching { setForeground(buildForegroundInfo()) }

        if (!hasRequiredPermissions()) {
            Log.w(TAG, "Missing CAMERA/LOCATION permission → failure")
            return Result.failure()
        }

        val lens = Prefs(appContext).cameraLens
        val photo = runCatching { captureImage(lens) }
            .onFailure { Log.e(TAG, "Capture failed: ${it.message}", it) }
            .getOrNull()
            ?: return Result.retry()
        Log.i(TAG, "Captured ${photo.name} (${photo.length()}B)")

        val location = runCatching { fetchLocation() }
            .onFailure { Log.w(TAG, "Location fetch failed: ${it.message}") }
            .getOrNull()
        Log.i(
            TAG,
            "Location: ${location?.latitude},${location?.longitude} acc=${location?.accuracy}"
        )

        val serverUrl = Prefs(appContext).serverUrl()
        val uploaded = withContext(Dispatchers.IO) {
            Uploader.upload(photo, location, serverUrl)
        }
        photo.delete()
        if (uploaded) {
            Prefs(appContext).lastCaptureAt = System.currentTimeMillis()
            Log.i(TAG, "Worker success")
        } else {
            Log.w(TAG, "Worker will retry")
        }
        return if (uploaded) Result.success() else Result.retry()
    }

    private fun hasRequiredPermissions(): Boolean {
        val required = listOf(
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION
        )
        return required.all {
            ContextCompat.checkSelfPermission(appContext, it) ==
                PackageManager.PERMISSION_GRANTED
        }
    }

    private fun buildForegroundInfo(): ForegroundInfo {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = appContext.getSystemService(NotificationManager::class.java)
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                nm.createNotificationChannel(
                    NotificationChannel(
                        CHANNEL_ID,
                        "CivikEye capture",
                        NotificationManager.IMPORTANCE_LOW
                    )
                )
            }
        }
        val notification = NotificationCompat.Builder(appContext, CHANNEL_ID)
            .setContentTitle("CivikEye capture")
            .setContentText("Photo aur location upload ho raha hai…")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setOngoing(true)
            .build()

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ForegroundInfo(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            ForegroundInfo(NOTIFICATION_ID, notification)
        }
    }

    @SuppressLint("MissingPermission")
    private suspend fun fetchLocation(): Location? {
        val client = LocationServices.getFusedLocationProviderClient(appContext)
        val cts = CancellationTokenSource()
        val current = runCatching {
            client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token).await()
        }.getOrNull()
        return current ?: runCatching { client.lastLocation.await() }.getOrNull()
    }

    private suspend fun captureImage(lens: Int): File = cameraMutex.withLock {
        captureImageLocked(lens)
    }

    private suspend fun captureImageLocked(lens: Int): File =
        suspendCancellableCoroutine { cont ->
            val future = ProcessCameraProvider.getInstance(appContext)
            future.addListener({
                val provider = runCatching { future.get() }.getOrElse {
                    cont.resumeWithException(it); return@addListener
                }
                Handler(Looper.getMainLooper()).post {
                    val selector = CameraSelector.Builder()
                        .requireLensFacing(lens)
                        .build()
                    val capture = ImageCapture.Builder().build()
                    try {
                        provider.unbindAll()
                        provider.bindToLifecycle(
                            ProcessLifecycleOwner.get(),
                            selector,
                            capture
                        )
                    } catch (t: Throwable) {
                        cont.resumeWithException(t)
                        return@post
                    }

                    val output = File(
                        appContext.cacheDir,
                        "capture_${System.currentTimeMillis()}.jpg"
                    )
                    val options = ImageCapture.OutputFileOptions.Builder(output).build()
                    capture.takePicture(
                        options,
                        ContextCompat.getMainExecutor(appContext),
                        object : ImageCapture.OnImageSavedCallback {
                            override fun onImageSaved(result: ImageCapture.OutputFileResults) {
                                Handler(Looper.getMainLooper()).post {
                                    runCatching { provider.unbindAll() }
                                }
                                if (cont.isActive) cont.resume(output)
                            }

                            override fun onError(exc: ImageCaptureException) {
                                Handler(Looper.getMainLooper()).post {
                                    runCatching { provider.unbindAll() }
                                }
                                if (cont.isActive) cont.resumeWithException(exc)
                            }
                        }
                    )
                }
            }, ContextCompat.getMainExecutor(appContext))

            cont.invokeOnCancellation {
                Handler(Looper.getMainLooper()).post {
                    runCatching { future.get().unbindAll() }
                }
            }
        }

    private companion object {
        const val TAG = "CivikEye/Worker"
        const val CHANNEL_ID = "damage_capture_channel"
        const val NOTIFICATION_ID = 1001

        // Serializes camera access across any concurrent workers.
        val cameraMutex = Mutex()
    }
}
