package com.example.dammage

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

object ReportsStore {
    private const val TAG = "CivikEye/Store"
    private const val POLL_INTERVAL_MS = 5_000L
    private const val LIMIT = 50

    private val _events = MutableStateFlow<List<ReportEvent>>(emptyList())
    val events: StateFlow<List<ReportEvent>> = _events.asStateFlow()

    private val _lastRefresh = MutableStateFlow(0L)
    val lastRefresh: StateFlow<Long> = _lastRefresh.asStateFlow()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var pollJob: Job? = null
    private var currentEndpoint: Pair<String, Int>? = null

    @Synchronized
    fun start(host: String, port: Int) {
        val endpoint = host to port
        if (currentEndpoint == endpoint && pollJob?.isActive == true) return
        stop()
        currentEndpoint = endpoint
        Log.i(TAG, "polling $host:$port every ${POLL_INTERVAL_MS}ms")
        pollJob = scope.launch {
            var tick = 0
            while (isActive) {
                tick++
                runCatching {
                    val (h, p) = currentEndpoint ?: return@launch
                    val fresh = ReportsFetcher.fetchRecent(h, p, limit = LIMIT)
                    Log.i(TAG, "tick #$tick → ${fresh.size} reports")
                    _events.value = fresh
                    _lastRefresh.value = System.currentTimeMillis()
                }.onFailure { Log.e(TAG, "tick #$tick failed: ${it.message}") }
                delay(POLL_INTERVAL_MS)
            }
        }
    }

    suspend fun refreshNow() {
        val (h, p) = currentEndpoint ?: return
        val fresh = ReportsFetcher.fetchRecent(h, p, limit = LIMIT)
        Log.i(TAG, "manual refresh → ${fresh.size} reports")
        _events.value = fresh
        _lastRefresh.value = System.currentTimeMillis()
    }

    @Synchronized
    fun stop() {
        pollJob?.cancel()
        pollJob = null
        currentEndpoint = null
    }
}
