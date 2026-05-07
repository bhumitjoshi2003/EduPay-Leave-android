# ── Stack trace readability ────────────────────────────────────────────────
# Keep file names and line numbers so crash reports are useful.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── Capacitor core ────────────────────────────────────────────────────────
# The Capacitor bridge exposes Java methods to the WebView JS layer.
# Stripping these breaks every plugin call.
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class com.getcapacitor.** { *; }

# ── App package ───────────────────────────────────────────────────────────
-keep class in.edunexify.app.** { *; }

# ── WebView JavaScript Interface ──────────────────────────────────────────
# Any method annotated @JavascriptInterface must not be renamed or removed.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── Firebase (push notifications) ─────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── AndroidX / Jetpack ────────────────────────────────────────────────────
-keep class androidx.** { *; }
-dontwarn androidx.**

# ── Splash screen ─────────────────────────────────────────────────────────
-keep class androidx.core.splashscreen.** { *; }

# ── Kotlin (if any Kotlin plugins are added later) ────────────────────────
-keep class kotlin.** { *; }
-dontwarn kotlin.**

# ── Suppress common harmless warnings ─────────────────────────────────────
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
