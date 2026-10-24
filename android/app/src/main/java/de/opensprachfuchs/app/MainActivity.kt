package de.opensprachfuchs.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.net.Uri
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.view.WindowInsets
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import android.window.OnBackInvokedDispatcher
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/**
 * OpenSprachFuchs as an Android app: the game (../app and a copy of all language packs, copied into the assets at
 * build time) runs in a WebView served from https://appassets.androidplatform.net, so it works offline and keeps
 * its progress in the WebView's storage. The backend is only reached over HTTPS, for backups, friends and updates.
 * The page talks to the app through `window.AndroidBridge` for speech, the daily reminder, sharing and links.
 */
class MainActivity : Activity(), TextToSpeech.OnInitListener {

    private lateinit var web: WebView
    private var tts: TextToSpeech? = null
    @Volatile private var ttsReady = false
    private var recognizer: SpeechRecognizer? = null
    private var pendingLang: String? = null
    /** A friend link that started the app; the page picks it up with `takeLink()` once it has loaded. */
    @Volatile private var pendingLink: String? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        tts = TextToSpeech(this, this)

        val assets = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            // Listening tasks start their audio by themselves.
            settings.mediaPlaybackRequiresUserGesture = false
            addJavascriptInterface(Bridge(), "AndroidBridge")
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assets.shouldInterceptRequest(request.url)
            }
        }

        // Android 15+ draws the app behind the system bars; keep the game clear of them and of the keyboard.
        val root = FrameLayout(this).apply {
            setBackgroundColor(getColor(R.color.bg))
            addView(web, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
            setOnApplyWindowInsetsListener { v, insets ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout() or WindowInsets.Type.ime())
                    v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
                    // Consumed here: newer WebViews would otherwise also report the bars to the page as
                    // env(safe-area-inset-*), and the header and tab bar would keep a second, empty gap.
                    WindowInsets.CONSUMED
                } else insets
            }
        }
        setContentView(root)

        if (savedInstanceState == null) { pendingLink = linkOf(intent); web.loadUrl(START_URL) } else web.restoreState(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) { handleBack() }
        }
    }

    /** Friend links while the app is already open go straight to the page (launchMode singleTask). */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val link = linkOf(intent) ?: return
        web.evaluateJavascript("window.opensprachfuchsLink && window.opensprachfuchsLink(${JSONObject.quote(link)})", null)
    }

    private fun linkOf(intent: Intent?): String? =
        intent?.takeIf { it.action == Intent.ACTION_VIEW }?.data?.takeIf { it.scheme == "https" }?.toString()

    /** The game closes dialogs and leaves lessons itself; only on the home screen does the app go to the background. */
    private fun handleBack() {
        web.evaluateJavascript("window.opensprachfuchsBack ? String(window.opensprachfuchsBack()) : 'false'") { result ->
            if (result != "\"true\"") moveTaskToBack(true)
        }
    }

    @Deprecated("Only used below Android 13; newer versions use the OnBackInvokedCallback above.")
    override fun onBackPressed() {
        handleBack()
    }

    override fun onInit(status: Int) {
        ttsReady = status == TextToSpeech.SUCCESS
    }

    override fun onPause() {
        tts?.stop()
        recognizer?.cancel()
        web.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onDestroy() {
        tts?.shutdown()
        recognizer?.destroy()
        web.destroy()
        super.onDestroy()
    }

    /* ---------- Speech recognition for speaking tasks ---------- */

    /** Sends a result or error to the page, which waits for it in `window.opensprachfuchsSpeech`. */
    private fun sendSpeech(message: JSONObject) {
        web.post { web.evaluateJavascript("window.opensprachfuchsSpeech && window.opensprachfuchsSpeech($message)", null) }
    }

    private fun speechError(code: String) = sendSpeech(JSONObject().put("type", "error").put("code", code))

    private fun listen(lang: String) {
        recognizer?.destroy()
        recognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {}
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onPartialResults(partialResults: Bundle?) {}
                override fun onEvent(eventType: Int, params: Bundle?) {}

                override fun onResults(results: Bundle?) {
                    val texts = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: arrayListOf<String>()
                    sendSpeech(JSONObject().put("type", "result").put("texts", JSONArray(texts)))
                }

                override fun onError(error: Int) {
                    speechError(
                        when (error) {
                            SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "no-speech"
                            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "permission"
                            else -> "unavailable"
                        }
                    )
                }
            })
            startListening(
                Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
                    .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
            )
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQ_MIC) return
        val lang = pendingLang
        pendingLang = null
        if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED && lang != null) listen(lang)
        else speechError("permission")
    }

    /** Called from the page as `window.AndroidBridge`. Runs on a WebView thread, not the UI thread. */
    inner class Bridge {
        /** Speaks [text] with the phone's text-to-speech; [lang] is a tag such as "pt-BR". Returns false if no voice is available. */
        @JavascriptInterface
        fun speak(text: String, lang: String, slow: Boolean): Boolean {
            val engine = tts ?: return false
            if (!ttsReady) return false
            val available = engine.setLanguage(Locale.forLanguageTag(lang)) >= TextToSpeech.LANG_AVAILABLE
            engine.setSpeechRate(if (slow) 0.6f else 0.95f)
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "opensprachfuchs")
            return available
        }

        /** Speaks [text] after whatever is being said now (a short pause in between), e.g. the next line in a dialogue. */
        @JavascriptInterface
        fun speakQueued(text: String, lang: String, slow: Boolean): Boolean {
            val engine = tts ?: return false
            if (!ttsReady) return false
            val available = engine.setLanguage(Locale.forLanguageTag(lang)) >= TextToSpeech.LANG_AVAILABLE
            engine.setSpeechRate(if (slow) 0.6f else 0.95f)
            engine.playSilentUtterance(500, TextToSpeech.QUEUE_ADD, "opensprachfuchs-pause")
            engine.speak(text, TextToSpeech.QUEUE_ADD, null, "opensprachfuchs-next")
            return available
        }

        @JavascriptInterface
        fun stop() {
            tts?.stop()
        }

        @JavascriptInterface
        fun hasVoice(lang: String): Boolean {
            val engine = tts ?: return false
            return ttsReady && engine.isLanguageAvailable(Locale.forLanguageTag(lang)) >= TextToSpeech.LANG_AVAILABLE
        }

        /** Whether the phone has a speech recognition service at all. */
        @JavascriptInterface
        fun canRecognize(): Boolean = SpeechRecognizer.isRecognitionAvailable(this@MainActivity)

        /** Listens once in [lang]; the result goes to `window.opensprachfuchsSpeech`. Asks for the microphone the first time. */
        @JavascriptInterface
        fun startListening(lang: String) {
            runOnUiThread {
                tts?.stop()
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) listen(lang)
                else {
                    pendingLang = lang
                    requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQ_MIC)
                }
            }
        }

        @JavascriptInterface
        fun stopListening() {
            runOnUiThread { recognizer?.cancel() }
        }

        /** Turns the daily reminder on or off at [hour]:[minute]; asks for permission to notify on Android 13+. */
        @JavascriptInterface
        fun setReminder(on: Boolean, hour: Int, minute: Int) {
            Reminders.save(this@MainActivity, on, hour, minute)
            if (on && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) runOnUiThread { requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIFY) }
        }

        /** The friend link that started the app, once (empty if there was none). */
        @JavascriptInterface
        fun takeLink(): String = (pendingLink ?: "").also { pendingLink = null }

        /** The installed version (versionName), for the update check against the GitHub releases. */
        @JavascriptInterface
        fun appVersion(): String = packageManager.getPackageInfo(packageName, 0).versionName ?: ""

        /** Copies [text] (the secret key) to the clipboard. */
        @JavascriptInterface
        fun copy(text: String) {
            runOnUiThread {
                getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("OpenSprachFuchs", text))
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) Toast.makeText(this@MainActivity, "Kopiert", Toast.LENGTH_SHORT).show()
            }
        }

        /** Opens the share sheet, e.g. for the friend code. */
        @JavascriptInterface
        fun share(text: String) {
            runOnUiThread {
                startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), null))
            }
        }

        /** Opens an https link (the release page of an update) in the browser. */
        @JavascriptInterface
        fun openUrl(url: String) {
            if (!url.startsWith("https://")) return
            runOnUiThread { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
        }

        /** The page reports the last day with a finished round, so the reminder stays quiet once the goal is met. */
        @JavascriptInterface
        fun reportDay(lastDay: String, streak: Int) {
            Reminders.report(this@MainActivity, lastDay, streak)
        }
    }

    private companion object {
        const val START_URL = "https://appassets.androidplatform.net/assets/index.html"
        const val REQ_MIC = 1
        const val REQ_NOTIFY = 2
    }
}
