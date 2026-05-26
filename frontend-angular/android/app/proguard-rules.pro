# --- Capacitor core + plugin discovery (uses reflection) ---
-keep public class com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep public class com.capacitorjs.plugins.** { *; }

-keepclassmembers public class * extends com.getcapacitor.Plugin {
  @com.getcapacitor.PluginMethod <methods>;
  @com.getcapacitor.annotation.PluginMethod <methods>;
  @com.getcapacitor.annotation.Permission <methods>;
  @com.getcapacitor.annotation.ActivityCallback <methods>;
  @com.getcapacitor.annotation.PermissionCallback <methods>;
}
-keepclassmembers class * {
  @com.getcapacitor.annotation.CapacitorPlugin *;
}

# Cordova-bridge compat (Capacitor's Cordova layer)
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# --- Firebase / FCM (push notifications plugin) ---
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keep class com.google.android.gms.common.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# --- AndroidX runtime reflection ---
-keep class androidx.lifecycle.** { *; }
-keep class androidx.core.app.CoreComponentFactory { *; }
-dontwarn androidx.**

# --- WebView JS bridge ---
# Capacitor injects @JavascriptInterface methods; R8 must not rename or strip them.
-keepclassmembers class * {
  @android.webkit.JavascriptInterface <methods>;
}

# --- Generic safety ---
-keepattributes Signature,*Annotation*,EnclosingMethod,InnerClasses
-keepclassmembers enum * {
  public static **[] values();
  public static ** valueOf(java.lang.String);
}
-keepclasseswithmembernames class * {
  native <methods>;
}
-keepclassmembers class * implements java.io.Serializable {
  static final long serialVersionUID;
  private static final java.io.ObjectStreamField[] serialPersistentFields;
  private void writeObject(java.io.ObjectOutputStream);
  private void readObject(java.io.ObjectInputStream);
  java.lang.Object writeReplace();
  java.lang.Object readResolve();
}

# --- Keep readable stack traces so future crashes are debuggable ---
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
