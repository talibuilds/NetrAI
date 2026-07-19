package com.example.dammage

import android.content.Context
import androidx.camera.core.CameraSelector
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.SharedPreferencesMigration
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking

private const val STORE_NAME = "dammage_prefs"

// DataStore with automatic migration from the old SharedPreferences file.
private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(
    name = STORE_NAME,
    produceMigrations = { ctx -> listOf(SharedPreferencesMigration(ctx, STORE_NAME)) }
)

class Prefs(ctx: Context) {
    private val store = ctx.applicationContext.dataStore

    var cameraLens: Int
        get() = readInt(KEY_LENS, CameraSelector.LENS_FACING_BACK)
        set(value) = writeInt(KEY_LENS, value)

    var running: Boolean
        get() = readBool(KEY_RUNNING, false)
        set(value) = writeBool(KEY_RUNNING, value)

    var intervalMinutes: Long
        get() = readLong(KEY_INTERVAL, 30L)
        set(value) = writeLong(KEY_INTERVAL, value)

    var scheduledAt: Long
        get() = readLong(KEY_SCHEDULED_AT, 0L)
        set(value) = writeLong(KEY_SCHEDULED_AT, value)

    var lastCaptureAt: Long
        get() = readLong(KEY_LAST_CAPTURE, 0L)
        set(value) = writeLong(KEY_LAST_CAPTURE, value)

    var serverHost: String
        get() = readString(KEY_HOST, DEFAULT_HOST)
        set(value) = writeString(KEY_HOST, value)

    var serverPort: Int
        get() = readInt(KEY_PORT, DEFAULT_PORT)
        set(value) = writeInt(KEY_PORT, value)

    var userName: String?
        get() = readStringOrNull(KEY_USER_NAME)
        set(value) {
            if (value.isNullOrBlank()) removeKey(KEY_USER_NAME)
            else writeString(KEY_USER_NAME, value)
        }

    fun hasName(): Boolean = !userName.isNullOrBlank()

    fun serverUrl(): String {
        val scheme = if (serverHost.startsWith("10.") || serverHost.startsWith("192.") || serverHost.startsWith("127.")) "http" else "https"
        val portStr = if (serverPort == 80 || serverPort == 443) "" else ":$serverPort"
        return "$scheme://$serverHost$portStr/report"
    }

    fun serverHostFlow(): Flow<String> =
        store.data.map { it[KEY_HOST] ?: DEFAULT_HOST }

    fun serverPortFlow(): Flow<Int> =
        store.data.map { it[KEY_PORT] ?: DEFAULT_PORT }

    // --- Sync bridges over DataStore ---
    private fun readInt(k: Preferences.Key<Int>, default: Int): Int =
        runBlocking { store.data.first()[k] ?: default }

    private fun readLong(k: Preferences.Key<Long>, default: Long): Long =
        runBlocking { store.data.first()[k] ?: default }

    private fun readBool(k: Preferences.Key<Boolean>, default: Boolean): Boolean =
        runBlocking { store.data.first()[k] ?: default }

    private fun readString(k: Preferences.Key<String>, default: String): String =
        runBlocking { store.data.first()[k] ?: default }

    private fun readStringOrNull(k: Preferences.Key<String>): String? =
        runBlocking { store.data.first()[k] }

    private fun writeInt(k: Preferences.Key<Int>, v: Int) {
        runBlocking { store.edit { it[k] = v } }
    }

    private fun writeLong(k: Preferences.Key<Long>, v: Long) {
        runBlocking { store.edit { it[k] = v } }
    }

    private fun writeBool(k: Preferences.Key<Boolean>, v: Boolean) {
        runBlocking { store.edit { it[k] = v } }
    }

    private fun writeString(k: Preferences.Key<String>, v: String) {
        runBlocking { store.edit { it[k] = v } }
    }

    private fun removeKey(k: Preferences.Key<*>) {
        runBlocking { store.edit { it.remove(k) } }
    }

    private companion object {
        val KEY_LENS = intPreferencesKey("camera_lens")
        val KEY_RUNNING = booleanPreferencesKey("running")
        val KEY_INTERVAL = longPreferencesKey("interval_minutes")
        val KEY_SCHEDULED_AT = longPreferencesKey("scheduled_at")
        val KEY_LAST_CAPTURE = longPreferencesKey("last_capture_at")
        val KEY_HOST = stringPreferencesKey("server_host")
        val KEY_PORT = intPreferencesKey("server_port")
        val KEY_USER_NAME = stringPreferencesKey("user_name")
        const val DEFAULT_HOST = "netrai-backend.onrender.com"
        const val DEFAULT_PORT = 443
    }
}
