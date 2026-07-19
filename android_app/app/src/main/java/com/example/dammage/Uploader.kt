package com.example.dammage

import android.location.Location
import android.util.Log
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.util.concurrent.TimeUnit

object Uploader {
    private const val TAG = "CivikEye/Upload"

    // Optional — server will default to "" if blank.
    const val USER_EMAIL = ""

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    fun upload(photo: File, location: Location?, serverUrl: String): Boolean {
        if (location == null) {
            Log.w(TAG, "Skipping upload — no location available")
            return false
        }
        val lat = location.latitude
        val lng = location.longitude

        Log.i(
            TAG,
            "POST $serverUrl  photo=${photo.name} (${photo.length()}B)  " +
                "lat=$lat lng=$lng acc=${location.accuracy}m"
        )

        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart(
                "file",
                photo.name,
                photo.asRequestBody("image/jpeg".toMediaTypeOrNull())
            )
            .addFormDataPart("lat", lat.toString())
            .addFormDataPart("lng", lng.toString())
            .addFormDataPart("email", USER_EMAIL)
            .build()

        val request = Request.Builder().url(serverUrl).post(body).build()
        val startMs = System.currentTimeMillis()

        return try {
            client.newCall(request).execute().use { res ->
                val took = System.currentTimeMillis() - startMs
                if (res.isSuccessful) {
                    val preview = res.body?.string()?.take(300) ?: ""
                    Log.i(TAG, "✓ ${res.code} in ${took}ms → $preview")
                    true
                } else {
                    val errBody = res.body?.string()?.take(300) ?: ""
                    Log.w(TAG, "✗ ${res.code} ${res.message} in ${took}ms → $errBody")
                    false
                }
            }
        } catch (t: Throwable) {
            val took = System.currentTimeMillis() - startMs
            Log.e(TAG, "✗ network failure after ${took}ms: ${t.javaClass.simpleName}: ${t.message}", t)
            false
        }
    }
}
