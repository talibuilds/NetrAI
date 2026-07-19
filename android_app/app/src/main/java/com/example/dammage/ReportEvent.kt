package com.example.dammage

import org.json.JSONArray
import org.json.JSONObject

data class ReportEvent(
    val id: String,
    val type: String,           // "trash" | "pothole"
    val status: String,         // pending | acknowledged | in_progress | resolved | rejected
    val lng: Double,
    val lat: Double,
    val severity: Double,
    val resolved: Boolean,
    val resolvedBy: String?,    // auto-clean | auto-stale | manual | admin | null
    val image: String?,
    val reportCount: Int,
    val email: String,
    val receivedAt: Long = System.currentTimeMillis()
) {
    companion object {
        fun fromJson(raw: String): ReportEvent? = try {
            fromJsonObject(JSONObject(raw))
        } catch (_: Throwable) {
            null
        }

        fun fromJsonArray(raw: String): List<ReportEvent> = try {
            val arr = JSONArray(raw)
            buildList(arr.length()) {
                for (i in 0 until arr.length()) {
                    arr.optJSONObject(i)?.let { fromJsonObject(it)?.also(::add) }
                }
            }
        } catch (_: Throwable) {
            emptyList()
        }

        private fun fromJsonObject(o: JSONObject): ReportEvent? {
            return try {
                // Two wire formats:
                //   MQTT payload  -> location.coordinates (GeoJSON Point)
                //   GET /reports  -> flat "coordinates" array
                val coords = o.optJSONObject("location")?.optJSONArray("coordinates")
                    ?: o.optJSONArray("coordinates")
                val lng = coords?.optDouble(0, 0.0) ?: 0.0
                val lat = coords?.optDouble(1, 0.0) ?: 0.0

                val id = o.optString("_id").ifBlank { o.optString("id") }
                if (id.isBlank()) return null

                ReportEvent(
                    id = id,
                    type = o.optString("type"),
                    status = o.optString("status", "pending"),
                    lng = lng,
                    lat = lat,
                    severity = o.optDouble("severity_score", 0.0),
                    resolved = o.optBoolean("resolved", false),
                    resolvedBy = o.optString("resolved_by")
                        .ifBlank { null }
                        ?.takeUnless { it == "null" },
                    image = o.optString("image").ifBlank { null },
                    reportCount = o.optInt("report_count", 1),
                    email = o.optString("email", "")
                )
            } catch (_: Throwable) {
                null
            }
        }
    }
}
