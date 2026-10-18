package com.phantom.echoes

import android.media.AudioAttributes
import android.media.MediaPlayer
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var mediaPlayer: MediaPlayer? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "echoes/audio",
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "play" -> {
                    val url = call.argument<String>("url")
                    if (url.isNullOrBlank()) {
                        result.error("invalid_url", "Audio URL is required", null)
                        return@setMethodCallHandler
                    }
                    try {
                        mediaPlayer?.release()
                        mediaPlayer = MediaPlayer().apply {
                            setAudioAttributes(
                                AudioAttributes.Builder()
                                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                    .setUsage(AudioAttributes.USAGE_MEDIA)
                                    .build(),
                            )
                            setDataSource(url)
                            setOnPreparedListener { it.start() }
                            setOnCompletionListener {
                                it.release()
                                mediaPlayer = null
                            }
                            prepareAsync()
                        }
                        result.success(null)
                    } catch (error: Exception) {
                        result.error("playback_failed", error.message, null)
                    }
                }
                "pause" -> {
                    mediaPlayer?.takeIf { it.isPlaying }?.pause()
                    result.success(null)
                }
                "stop" -> {
                    mediaPlayer?.release()
                    mediaPlayer = null
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onDestroy() {
        mediaPlayer?.release()
        mediaPlayer = null
        super.onDestroy()
    }
}
