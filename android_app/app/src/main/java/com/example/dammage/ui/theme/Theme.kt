package com.example.dammage.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val CivikEyeColors = darkColorScheme(
    primary = Accent,
    onPrimary = OnAccent,
    primaryContainer = Accent,
    onPrimaryContainer = OnAccent,

    secondary = Accent,
    onSecondary = OnAccent,
    secondaryContainer = Surface2,
    onSecondaryContainer = TextPrimary,

    tertiary = AccentDim,
    onTertiary = OnAccent,

    background = Bg,
    onBackground = TextPrimary,

    surface = Bg,
    onSurface = TextPrimary,

    surfaceVariant = Surface1,
    onSurfaceVariant = TextSecondary,

    surfaceContainer = Surface1,
    surfaceContainerLow = Surface1,
    surfaceContainerLowest = Bg,
    surfaceContainerHigh = Surface2,
    surfaceContainerHighest = Surface3,

    outline = Outline,
    outlineVariant = OutlineDim,

    error = Danger,
    onError = OnDanger,
    errorContainer = DangerDim,
    onErrorContainer = Danger,

    scrim = Color(0xFF000000)
)

@Composable
fun CivikEyeTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = CivikEyeColors,
        typography = Typography,
        content = content
    )
}
