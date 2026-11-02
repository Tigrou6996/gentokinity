/// Configurazione passata alla compilazione, per esempio:
///   flutter run --dart-define-from-file=config.json
/// (vedi config.example.json e README.md). Nessuna chiave segreta finisce nel codice:
/// la chiave ElevenLabs sta nei Secrets di Supabase, quella di Google Maps nei file nativi.
class AppConfig {
  /// URL del progetto Supabase, es. https://xxxx.supabase.co
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');

  /// Chiave "anon" pubblica del progetto Supabase (serve per chiamare le funzioni).
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  /// Server con orari e fermate. Se vuoto usa la funzione Supabase "transit".
  /// Si può puntare anche a un'istanza db-rest (es. https://v6.db.transport.rest).
  static const transitBaseOverride = String.fromEnvironment('TRANSIT_BASE_URL');

  static String get transitBase {
    if (transitBaseOverride.isNotEmpty) return transitBaseOverride;
    if (supabaseUrl.isNotEmpty) return '$supabaseUrl/functions/v1/transit';
    return 'https://v6.db.transport.rest';
  }

  static String get ttsUrl => supabaseUrl.isEmpty ? '' : '$supabaseUrl/functions/v1/tts';

  /// Intestazioni per le chiamate alle funzioni Supabase.
  static Map<String, String> get supabaseHeaders => supabaseAnonKey.isEmpty
      ? const {}
      : {'Authorization': 'Bearer $supabaseAnonKey', 'apikey': supabaseAnonKey};
}
