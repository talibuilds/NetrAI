package com.example.dammage

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.location.Location
import android.media.ExifInterface
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@Composable
fun CaptureScreen(onClose: () -> Unit) {
    val ctx = LocalContext.current
    val prefs = remember { Prefs(ctx) }
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()

    var captured by remember { mutableStateOf<File?>(null) }
    var uploading by remember { mutableStateOf(false) }
    val lens = prefs.cameraLens

    val previewView = remember {
        PreviewView(ctx).apply {
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
    }
    val imageCapture = remember { ImageCapture.Builder().build() }

    BackHandler {
        if (captured != null) {
            captured?.delete()
            captured = null
        } else if (!uploading) {
            onClose()
        }
    }

    LaunchedEffect(lens, captured) {
        runCatching {
            val provider = awaitProvider(ctx)
            provider.unbindAll()
            if (captured == null) {
                val preview = Preview.Builder().build().also {
                    it.surfaceProvider = previewView.surfaceProvider
                }
                val selector = CameraSelector.Builder().requireLensFacing(lens).build()
                provider.bindToLifecycle(lifecycleOwner, selector, preview, imageCapture)
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            val future = ProcessCameraProvider.getInstance(ctx)
            future.addListener({
                runCatching { future.get().unbindAll() }
            }, ContextCompat.getMainExecutor(ctx))
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        // Main area: live preview or captured still
        if (captured == null) {
            AndroidView(
                factory = { previewView },
                modifier = Modifier.fillMaxSize()
            )
        } else {
            val bitmap = remember(captured) {
                captured?.let {
                    runCatching { loadOriented(it.absolutePath) }.getOrNull()
                }
            }
            if (bitmap != null) {
                Image(
                    bitmap = bitmap,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Fit
                )
            }
        }

        // Top bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CircleIconButton(
                icon = Icons.Filled.Close,
                tint = Color.White,
                bg = Color.Black.copy(alpha = 0.45f),
                onClick = {
                    if (captured != null) {
                        captured?.delete()
                        captured = null
                    } else if (!uploading) {
                        onClose()
                    }
                }
            )
            Spacer(Modifier.fillMaxWidth().weight(1f))
            if (captured != null && !uploading) {
                Text(
                    "Review",
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp
                )
            }
            Spacer(Modifier.fillMaxWidth().weight(1f))
            Spacer(Modifier.size(48.dp))
        }

        // Bottom controls
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = 40.dp),
            contentAlignment = Alignment.Center
        ) {
            when {
                uploading -> {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(44.dp),
                            strokeWidth = 3.dp,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(Modifier.height(12.dp))
                        Text("Uploading…", color = Color.White)
                    }
                }
                captured == null -> {
                    ShutterButton(onClick = {
                        val file = File(
                            ctx.cacheDir,
                            "manual_${System.currentTimeMillis()}.jpg"
                        )
                        val options = ImageCapture.OutputFileOptions.Builder(file).build()
                        imageCapture.takePicture(
                            options,
                            ContextCompat.getMainExecutor(ctx),
                            object : ImageCapture.OnImageSavedCallback {
                                override fun onImageSaved(result: ImageCapture.OutputFileResults) {
                                    captured = file
                                }
                                override fun onError(exc: ImageCaptureException) {
                                    Toast.makeText(ctx, "Capture failed", Toast.LENGTH_SHORT).show()
                                }
                            }
                        )
                    })
                }
                else -> {
                    Row(horizontalArrangement = Arrangement.spacedBy(52.dp)) {
                        CircleIconButton(
                            icon = Icons.Filled.Close,
                            tint = Color.White,
                            bg = Color(0xFF2A2C30),
                            size = 68.dp,
                            iconSize = 28.dp,
                            onClick = {
                                captured?.delete()
                                captured = null
                            }
                        )
                        CircleIconButton(
                            icon = Icons.Filled.Check,
                            tint = Color.Black,
                            bg = MaterialTheme.colorScheme.primary,
                            size = 68.dp,
                            iconSize = 32.dp,
                            onClick = {
                                val file = captured ?: return@CircleIconButton
                                scope.launch {
                                    uploading = true
                                    val loc = fetchLocationUi(ctx)
                                    val ok = withContext(Dispatchers.IO) {
                                        Uploader.upload(file, loc, prefs.serverUrl())
                                    }
                                    file.delete()
                                    uploading = false
                                    Toast.makeText(
                                        ctx,
                                        if (ok) "Sent ✓" else "Upload failed",
                                        Toast.LENGTH_SHORT
                                    ).show()
                                    if (ok) {
                                        prefs.lastCaptureAt = System.currentTimeMillis()
                                        onClose()
                                    } else {
                                        captured = null
                                    }
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ShutterButton(onClick: () -> Unit) {
    Box(
        modifier = Modifier.size(80.dp),
        contentAlignment = Alignment.Center
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .clip(CircleShape)
                .border(3.dp, Color.White, CircleShape)
        )
        Surface(
            onClick = onClick,
            shape = CircleShape,
            color = Color.White,
            modifier = Modifier.size(64.dp)
        ) {}
    }
}

@Composable
private fun CircleIconButton(
    icon: ImageVector,
    tint: Color,
    bg: Color,
    size: Dp = 48.dp,
    iconSize: Dp = 22.dp,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = bg,
        modifier = Modifier.size(size)
    ) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = tint, modifier = Modifier.size(iconSize))
        }
    }
}

private fun loadOriented(path: String): ImageBitmap? {
    val raw = BitmapFactory.decodeFile(path) ?: return null
    val orientation = runCatching {
        ExifInterface(path).getAttributeInt(
            ExifInterface.TAG_ORIENTATION,
            ExifInterface.ORIENTATION_NORMAL
        )
    }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)

    val matrix = Matrix()
    when (orientation) {
        ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
        ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
        ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
        ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.preScale(-1f, 1f)
        ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.preScale(1f, -1f)
        ExifInterface.ORIENTATION_TRANSPOSE -> {
            matrix.postRotate(90f); matrix.preScale(-1f, 1f)
        }
        ExifInterface.ORIENTATION_TRANSVERSE -> {
            matrix.postRotate(270f); matrix.preScale(-1f, 1f)
        }
    }

    val oriented = if (matrix.isIdentity) raw
    else Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, matrix, true)
    if (oriented !== raw) raw.recycle()
    return oriented.asImageBitmap()
}

private suspend fun awaitProvider(ctx: Context): ProcessCameraProvider =
    suspendCancellableCoroutine { cont ->
        val future = ProcessCameraProvider.getInstance(ctx)
        future.addListener({
            try {
                cont.resume(future.get())
            } catch (t: Throwable) {
                cont.resumeWithException(t)
            }
        }, ContextCompat.getMainExecutor(ctx))
    }

@SuppressLint("MissingPermission")
private suspend fun fetchLocationUi(ctx: Context): Location? {
    val client = LocationServices.getFusedLocationProviderClient(ctx)
    val cts = CancellationTokenSource()
    return runCatching {
        client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token).await()
    }.getOrNull() ?: runCatching { client.lastLocation.await() }.getOrNull()
}
