package com.example.dammage

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.AddAPhoto
import androidx.compose.material.icons.filled.Cameraswitch
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import kotlinx.coroutines.delay
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.work.WorkInfo
import androidx.work.WorkManager
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.example.dammage.ui.theme.CivikEyeTheme
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            CivikEyeTheme { App() }
        }
    }
}

private enum class Screen { Splash, NameInput, Home, Capture, LiveActivity, ReportDetail }

@Composable
private fun App() {
    val ctx = LocalContext.current
    val prefs = remember { Prefs(ctx) }
    var screen by remember { mutableStateOf(Screen.Splash) }
    var selectedReport by remember { mutableStateOf<ReportEvent?>(null) }

    val host by prefs.serverHostFlow()
        .collectAsState(initial = prefs.serverHost)
    val port by prefs.serverPortFlow()
        .collectAsState(initial = prefs.serverPort)

    LaunchedEffect(host, port) {
        ReportsStore.start(host, port)
    }

    DisposableEffect(Unit) {
        onDispose { ReportsStore.stop() }
    }

    AnimatedContent(
        targetState = screen,
        transitionSpec = {
            fadeIn(tween(500, delayMillis = 120)) togetherWith
                fadeOut(tween(500))
        },
        label = "root"
    ) { s ->
        when (s) {
            Screen.Splash -> SplashScreen(onDone = {
                screen = if (prefs.hasName()) Screen.Home else Screen.NameInput
            })
            Screen.NameInput -> NameInputScreen(onSave = { name ->
                prefs.userName = name
                screen = Screen.Home
            })
            Screen.Home -> HomeScreen(
                onCaptureClick = { screen = Screen.Capture },
                onLiveActivityClick = { screen = Screen.LiveActivity }
            )
            Screen.Capture -> CaptureScreen(onClose = { screen = Screen.Home })
            Screen.LiveActivity -> LiveActivityScreen(
                onBack = { screen = Screen.Home },
                onReportClick = { event ->
                    selectedReport = event
                    screen = Screen.ReportDetail
                }
            )
            Screen.ReportDetail -> {
                val report = selectedReport
                if (report != null) {
                    ReportDetailScreen(
                        event = report,
                        onBack = { screen = Screen.LiveActivity }
                    )
                } else {
                    // Fallback: no report selected, bail back
                    LaunchedEffect(Unit) { screen = Screen.LiveActivity }
                }
            }
        }
    }
}

@Composable
fun HomeScreen(onCaptureClick: () -> Unit, onLiveActivityClick: () -> Unit) {
    val ctx = LocalContext.current
    val prefs = remember { Prefs(ctx) }
    var lens by remember { mutableIntStateOf(prefs.cameraLens) }
    var interval by remember { mutableLongStateOf(prefs.intervalMinutes) }
    var running by remember { mutableStateOf(prefs.running) }
    var showPreview by remember { mutableStateOf(false) }
    var hasCameraPerm by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    var needsBackgroundLocation by remember { mutableStateOf(false) }
    var showSettings by remember { mutableStateOf(false) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }

    LaunchedEffect(running) {
        if (running) {
            while (true) {
                now = System.currentTimeMillis()
                delay(1000L)
            }
        }
    }

    val startFlow: () -> Unit = {
        prefs.cameraLens = lens
        prefs.intervalMinutes = interval
        prefs.running = true
        Scheduler.schedule(ctx, interval)
        running = true
    }

    val cameraOnlyLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPerm = granted
        if (granted) showPreview = true
    }

    val manualCaptureLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val cam = grants[Manifest.permission.CAMERA] == true
        val loc = grants[Manifest.permission.ACCESS_FINE_LOCATION] == true
        hasCameraPerm = cam
        if (cam && loc) {
            onCaptureClick()
        } else {
            Toast.makeText(
                ctx,
                "Camera and location permission are required",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    val backgroundLocationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        needsBackgroundLocation = false
        if (granted) startFlow()
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val foregroundOk = grants[Manifest.permission.CAMERA] == true &&
            grants[Manifest.permission.ACCESS_FINE_LOCATION] == true
        hasCameraPerm = grants[Manifest.permission.CAMERA] == true
        if (!foregroundOk) return@rememberLauncherForActivityResult

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(
                ctx, Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            needsBackgroundLocation = true
        } else {
            startFlow()
        }
    }

    Scaffold(
        bottomBar = {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 32.dp)
            ) {
                ActionButton(
                    running = running,
                    onStart = {
                        val perms = buildList {
                            add(Manifest.permission.CAMERA)
                            add(Manifest.permission.ACCESS_FINE_LOCATION)
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                add(Manifest.permission.POST_NOTIFICATIONS)
                            }
                        }.toTypedArray()
                        permissionLauncher.launch(perms)
                    },
                    onStop = {
                        Scheduler.cancel(ctx)
                        prefs.running = false
                        running = false
                    }
                )
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(top = 12.dp, bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Header(onSettingsClick = { showSettings = true })
            StatusCard(
                running = running,
                intervalMinutes = interval,
                now = now,
                scheduledAt = prefs.scheduledAt,
                lastCaptureAt = prefs.lastCaptureAt
            )
            CameraPickerCard(
                selected = lens,
                enabled = !running,
                showPreview = showPreview && hasCameraPerm,
                onSelect = {
                    lens = it
                    prefs.cameraLens = it
                },
                onTogglePreview = {
                    if (!hasCameraPerm) {
                        cameraOnlyLauncher.launch(Manifest.permission.CAMERA)
                    } else {
                        showPreview = !showPreview
                    }
                },
                onCaptureNow = {
                    val cam = ContextCompat.checkSelfPermission(
                        ctx, Manifest.permission.CAMERA
                    ) == PackageManager.PERMISSION_GRANTED
                    val loc = ContextCompat.checkSelfPermission(
                        ctx, Manifest.permission.ACCESS_FINE_LOCATION
                    ) == PackageManager.PERMISSION_GRANTED
                    if (cam && loc) {
                        onCaptureClick()
                    } else {
                        manualCaptureLauncher.launch(
                            arrayOf(
                                Manifest.permission.CAMERA,
                                Manifest.permission.ACCESS_FINE_LOCATION
                            )
                        )
                    }
                }
            )
            IntervalPickerCard(
                selected = interval,
                enabled = !running,
                onSelect = {
                    interval = it
                    prefs.intervalMinutes = it
                }
            )
            StatsRow(intervalMinutes = interval)
            LiveActivityTeaser(onClick = onLiveActivityClick)
        }
    }

    if (showSettings) {
        ServerSettingsSheet(
            initialHost = prefs.serverHost,
            initialPort = prefs.serverPort,
            onDismiss = { showSettings = false },
            onSave = { host, port ->
                prefs.serverHost = host
                prefs.serverPort = port
                showSettings = false
            }
        )
    }

    if (needsBackgroundLocation) {
        AlertDialog(
            onDismissRequest = { needsBackgroundLocation = false },
            icon = { Icon(Icons.Filled.LocationOn, null) },
            title = { Text("Background location chahiye") },
            text = {
                Text(
                    "App band hone ke baad bhi location chahiye. Agle screen par " +
                        "\"Allow all the time\" select karein."
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        backgroundLocationLauncher.launch(
                            Manifest.permission.ACCESS_BACKGROUND_LOCATION
                        )
                    } else {
                        needsBackgroundLocation = false
                        startFlow()
                    }
                }) { Text("Continue") }
            },
            dismissButton = {
                TextButton(onClick = { needsBackgroundLocation = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun Header(onSettingsClick: () -> Unit) {
    val ctx = LocalContext.current
    val userName = remember { Prefs(ctx).userName }
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                "CIVIKEYE",
                style = MaterialTheme.typography.headlineLarge.copy(
                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                    letterSpacing = 1.sp
                ),
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary
            )
            Text(
                if (!userName.isNullOrBlank()) "Hi, $userName"
                else "PROJECT OVERVIEW & LIVE TELEMETRY",
                style = MaterialTheme.typography.labelSmall.copy(
                    letterSpacing = if (userName.isNullOrBlank()) 2.sp else 0.5.sp
                ),
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Surface(
            onClick = onSettingsClick,
            shape = CircleShape,
            color = MaterialTheme.colorScheme.surfaceContainerHigh,
            modifier = Modifier.size(44.dp)
        ) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Icon(
                    Icons.Filled.Settings,
                    contentDescription = "Server settings",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ServerSettingsSheet(
    initialHost: String,
    initialPort: Int,
    onDismiss: () -> Unit,
    onSave: (host: String, port: Int) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    var host by remember { mutableStateOf(initialHost) }
    var port by remember { mutableStateOf(initialPort.toString()) }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = MaterialTheme.colorScheme.primary,
        unfocusedBorderColor = MaterialTheme.colorScheme.outline,
        focusedLabelColor = MaterialTheme.colorScheme.primary,
        unfocusedLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
        focusedTextColor = MaterialTheme.colorScheme.onSurface,
        unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
        cursorColor = MaterialTheme.colorScheme.primary,
        focusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
        unfocusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant,
        focusedContainerColor = MaterialTheme.colorScheme.surfaceContainerHighest,
        unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh
    )

    val portNum = port.toIntOrNull()
    val canSave = host.isNotBlank() && portNum != null && portNum in 1..65535

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surfaceContainer,
        dragHandle = { BottomSheetDefaults.DragHandle() }
    ) {
        Column(
            modifier = Modifier
                .imePadding()
                .padding(horizontal = 24.dp)
                .padding(top = 4.dp, bottom = 28.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Filled.Settings,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(22.dp)
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    "Server",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(Modifier.height(6.dp))
            Text(
                "Phone aur server same wifi pe honi chahiye",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(20.dp))

            OutlinedTextField(
                value = host,
                onValueChange = { host = it.trim() },
                label = { Text("IP address") },
                singleLine = true,
                placeholder = { Text("192.168.1.3") },
                colors = fieldColors,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = port,
                onValueChange = { new -> port = new.filter { it.isDigit() }.take(5) },
                label = { Text("Port") },
                singleLine = true,
                placeholder = { Text("8000") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                colors = fieldColors,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(Modifier.height(14.dp))
            val scheme = if (host.startsWith("10.") || host.startsWith("192.") || host.startsWith("127.")) "http" else "https"
            val portStr = if (port == "80" || port == "443" || port.isBlank()) "" else ":$port"
            val previewUrl = "$scheme://${host.ifBlank { "?" }}$portStr/report"
            Text(
                previewUrl,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Medium
            )

            Spacer(Modifier.height(24.dp))

            Button(
                onClick = {
                    val p = portNum ?: return@Button
                    scope.launch {
                        sheetState.hide()
                    }.invokeOnCompletion {
                        if (!sheetState.isVisible) onSave(host, p)
                    }
                },
                enabled = canSave,
                shape = CircleShape,
                modifier = Modifier.fillMaxWidth().height(56.dp)
            ) {
                Text(
                    "Save",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

private fun formatInterval(minutes: Long): String = when {
    minutes < 60 -> "${minutes}m"
    minutes % 60 == 0L -> "${minutes / 60}h"
    else -> "${minutes / 60}h ${minutes % 60}m"
}

@Composable
private fun StatusCard(
    running: Boolean,
    intervalMinutes: Long,
    now: Long,
    scheduledAt: Long,
    lastCaptureAt: Long
) {
    val countdown = if (running) remainingString(
        now = now,
        intervalMs = intervalMinutes * 60_000L,
        base = maxOf(scheduledAt, lastCaptureAt)
    ) else null

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (running) MaterialTheme.colorScheme.primaryContainer
            else MaterialTheme.colorScheme.surfaceVariant
        ),
        shape = RoundedCornerShape(24.dp),
        border = if (running) BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.primary.copy(alpha = 0.35f)
        ) else null
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 24.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            PulsingDot(active = running)
            Spacer(Modifier.width(20.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    if (running) "Running" else "Stopped",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = if (running) MaterialTheme.colorScheme.onPrimaryContainer
                    else MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    if (running) "Har ${formatInterval(intervalMinutes)} pe 1 photo"
                    else "Start dabao",
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (running)
                        MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.75f)
                    else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (countdown != null) {
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        "Next",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                    Text(
                        countdown,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
        }
    }
}

private fun remainingString(now: Long, intervalMs: Long, base: Long): String {
    if (base <= 0) return "--:--"
    val nextAt = base + intervalMs
    val ms = (nextAt - now).coerceAtLeast(0)
    val total = ms / 1000
    val mm = total / 60
    val ss = total % 60
    return "%d:%02d".format(mm, ss)
}

@Composable
private fun PulsingDot(active: Boolean) {
    val color = if (active) Color(0xFF22C55E) else MaterialTheme.colorScheme.outline
    Box(Modifier.size(36.dp), contentAlignment = Alignment.Center) {
        if (active) {
            val transition = rememberInfiniteTransition(label = "pulse")
            val scale by transition.animateFloat(
                initialValue = 1f,
                targetValue = 2.4f,
                animationSpec = infiniteRepeatable(
                    animation = tween(1400, easing = LinearEasing),
                    repeatMode = RepeatMode.Restart
                ),
                label = "scale"
            )
            val ringAlpha by transition.animateFloat(
                initialValue = 0.5f,
                targetValue = 0f,
                animationSpec = infiniteRepeatable(
                    animation = tween(1400, easing = LinearEasing),
                    repeatMode = RepeatMode.Restart
                ),
                label = "alpha"
            )
            Box(
                Modifier
                    .size(16.dp)
                    .scale(scale)
                    .alpha(ringAlpha)
                    .background(color, CircleShape)
            )
        }
        Box(
            Modifier
                .size(14.dp)
                .background(color, CircleShape)
        )
    }
}

@Composable
private fun CameraPickerCard(
    selected: Int,
    enabled: Boolean,
    showPreview: Boolean,
    onSelect: (Int) -> Unit,
    onTogglePreview: () -> Unit,
    onCaptureNow: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        shape = RoundedCornerShape(24.dp)
    ) {
        Column(Modifier.padding(20.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    "Camera",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                AssistChip(
                    onClick = onTogglePreview,
                    label = {
                        Text(if (showPreview) "Hide" else "Preview")
                    },
                    leadingIcon = {
                        Icon(
                            if (showPreview) Icons.Filled.VisibilityOff
                            else Icons.Filled.Visibility,
                            null,
                            modifier = Modifier.size(AssistChipDefaults.IconSize)
                        )
                    }
                )
            }
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                CameraTile(
                    icon = Icons.Filled.PhotoCamera,
                    label = "Back",
                    selected = selected == CameraSelector.LENS_FACING_BACK,
                    enabled = enabled,
                    onClick = { onSelect(CameraSelector.LENS_FACING_BACK) },
                    modifier = Modifier.weight(1f)
                )
                CameraTile(
                    icon = Icons.Filled.Cameraswitch,
                    label = "Front",
                    selected = selected == CameraSelector.LENS_FACING_FRONT,
                    enabled = enabled,
                    onClick = { onSelect(CameraSelector.LENS_FACING_FRONT) },
                    modifier = Modifier.weight(1f)
                )
            }
            Spacer(Modifier.height(12.dp))
            FilledTonalButton(
                onClick = onCaptureNow,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.filledTonalButtonColors(
                    containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.14f),
                    contentColor = MaterialTheme.colorScheme.primary
                )
            ) {
                Icon(
                    Icons.Filled.AddAPhoto,
                    null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.width(10.dp))
                Text("Capture & send", fontWeight = FontWeight.SemiBold)
            }
            AnimatedVisibility(visible = showPreview) {
                Column {
                    Spacer(Modifier.height(14.dp))
                    CameraPreview(
                        lens = selected,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(240.dp)
                            .clip(RoundedCornerShape(18.dp))
                    )
                }
            }
        }
    }
}

@Composable
private fun CameraPreview(lens: Int, modifier: Modifier = Modifier) {
    val ctx = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val previewView = remember {
        PreviewView(ctx).apply {
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
    }

    LaunchedEffect(lens) {
        runCatching {
            val provider = awaitCameraProvider(ctx)
            val preview = Preview.Builder().build().also {
                it.surfaceProvider = previewView.surfaceProvider
            }
            val selector = CameraSelector.Builder().requireLensFacing(lens).build()
            provider.unbindAll()
            provider.bindToLifecycle(lifecycleOwner, selector, preview)
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
        modifier = modifier.background(Color.Black),
        contentAlignment = Alignment.Center
    ) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { previewView }
        )
    }
}

private suspend fun awaitCameraProvider(ctx: Context): ProcessCameraProvider =
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

@Composable
private fun CameraTile(
    icon: ImageVector,
    label: String,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val container by animateColorAsState(
        targetValue = if (selected) MaterialTheme.colorScheme.primary
        else MaterialTheme.colorScheme.surfaceContainerHighest,
        animationSpec = tween(260, easing = FastOutSlowInEasing),
        label = "tileContainer"
    )
    val content by animateColorAsState(
        targetValue = if (selected) MaterialTheme.colorScheme.onPrimary
        else MaterialTheme.colorScheme.onSurface,
        animationSpec = tween(260),
        label = "tileContent"
    )
    val iconScale by animateFloatAsState(
        targetValue = if (selected) 1.18f else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMedium
        ),
        label = "iconScale"
    )
    val borderAlpha by animateFloatAsState(
        targetValue = if (selected) 0f else 0.35f,
        animationSpec = tween(260),
        label = "tileBorder"
    )

    Surface(
        modifier = modifier.height(100.dp),
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(20.dp),
        color = container,
        border = BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outline.copy(alpha = borderAlpha)
        )
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(12.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icon, null, tint = content, modifier = Modifier.size(30.dp).scale(iconScale))
            Spacer(Modifier.height(8.dp))
            Text(
                label,
                color = content,
                fontWeight = FontWeight.Medium,
                style = MaterialTheme.typography.bodyLarge
            )
        }
    }
}

@Composable
private fun IntervalPickerCard(
    selected: Long,
    enabled: Boolean,
    onSelect: (Long) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        shape = RoundedCornerShape(24.dp)
    ) {
        Column(Modifier.padding(20.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    "Interval",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    formatInterval(selected),
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(Modifier.height(8.dp))
            Slider(
                value = selected.toFloat(),
                onValueChange = { onSelect(it.toLong()) },
                valueRange = 15f..60f,
                steps = 8,
                enabled = enabled,
                modifier = Modifier.fillMaxWidth()
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    "15m",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    "60m",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun LiveActivityTeaser(onClick: () -> Unit) {
    val events by ReportsStore.events.collectAsState()

    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surfaceContainerHigh
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 18.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    "Live Activity",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    "${events.size} ${if (events.size == 1) "report" else "reports"}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1
                )
            }
            Icon(
                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = "View all",
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(26.dp)
            )
        }
    }
}

@Composable
private fun StatsRow(intervalMinutes: Long) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Stat(
            Icons.Filled.Schedule,
            formatInterval(intervalMinutes),
            "interval",
            Modifier.weight(1f)
        )
        Stat(Icons.Filled.LocationOn, "GPS", "location", Modifier.weight(1f))
        Stat(Icons.Filled.CloudUpload, "Auto", "upload", Modifier.weight(1f))
    }
}

@Composable
private fun Stat(
    icon: ImageVector,
    value: String,
    label: String,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                icon,
                null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(22.dp)
            )
            Spacer(Modifier.height(8.dp))
            Text(
                value,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun ActionButton(
    running: Boolean,
    onStart: () -> Unit,
    onStop: () -> Unit
) {
    Button(
        onClick = if (running) onStop else onStart,
        modifier = Modifier.fillMaxWidth().height(56.dp),
        shape = CircleShape,
        colors = if (running) ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.errorContainer,
            contentColor = MaterialTheme.colorScheme.onErrorContainer
        ) else ButtonDefaults.buttonColors()
    ) {
        Icon(
            if (running) Icons.Filled.Stop else Icons.Filled.PlayArrow,
            contentDescription = null,
            modifier = Modifier.size(22.dp)
        )
        Spacer(Modifier.width(10.dp))
        Text(
            if (running) "Stop" else "Start",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
    }
}
