package com.example.dammage

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

object ReportsFetcher {
    private const val TAG = "CivikEye/Fetch"

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    suspend fun fetchRecent(
        host: String,
        httpPort: Int,
        limit: Int = 50,
        includeResolved: Boolean = false
    ): List<ReportEvent> = withContext(Dispatchers.IO) {
        val scheme = if (host.startsWith("10.") || host.startsWith("192.") || host.startsWith("127.")) "http" else "https"
        val portStr = if (httpPort == 80 || httpPort == 443) "" else ":$httpPort"
        val url = "$scheme://$host$portStr/reports?limit=$limit&include_resolved=$includeResolved"
        Log.i(TAG, "GET $url")
        runCatching {
            val req = Request.Builder().url(url).get().build()
            client.newCall(req).execute().use { res ->
                if (!res.isSuccessful) {
                    Log.w(TAG, "GET /reports → ${res.code}")
                    return@use emptyList()
                }
                val body = res.body?.string().orEmpty()
                ReportEvent.fromJsonArray(body).also {
                    Log.i(TAG, "fetched ${it.size} reports")
                }
            }
        }.getOrElse {
            Log.e(TAG, "fetch error: ${it.message}")
            emptyList()
        }
    }
}
