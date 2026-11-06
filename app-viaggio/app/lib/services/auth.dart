import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config.dart';

/// Accesso con Supabase Auth (email e password).
/// Se Supabase non è ancora configurato (config.json vuoto) l'app funziona "senza account".
class AuthService extends ChangeNotifier {
  AuthService._();
  static final AuthService instance = AuthService._();

  /// Link che riapre l'app dalle email di conferma e di recupero password.
  /// Va aggiunto in Supabase → Authentication → URL Configuration → Redirect URLs.
  static const redirect = 'com.lbswork.lbsviaggio://login-callback/';

  bool get configured => AppConfig.supabaseUrl.isNotEmpty && AppConfig.supabaseAnonKey.isNotEmpty;
  bool _ready = false;
  bool guest = false; // ha scelto "entra senza account"
  bool recovering = false; // aperto dal link "password dimenticata": deve scegliere la nuova password
  StreamSubscription<AuthState>? _sub;

  SupabaseClient? get client => _ready ? Supabase.instance.client : null;
  User? get user => client?.auth.currentUser;
  bool get signedIn => user != null;
  String get displayName => (user?.userMetadata?['nome'] as String?)?.trim().isNotEmpty == true ? user!.userMetadata!['nome'] as String : (user?.email ?? '');

  /// Callback chiamata quando l'utente entra (per sincronizzare i viaggi).
  Future<void> Function()? onSignedIn;

  Future<void> init() async {
    guest = (await SharedPreferences.getInstance()).getBool('ospite') ?? false;
    if (!configured) return;
    try {
      await Supabase.initialize(url: AppConfig.supabaseUrl, publishableKey: AppConfig.supabaseAnonKey);
      _ready = true;
      _sub = Supabase.instance.client.auth.onAuthStateChange.listen((s) {
        if (s.event == AuthChangeEvent.passwordRecovery) recovering = true;
        if (s.event == AuthChangeEvent.signedIn) unawaited(onSignedIn?.call());
        if (s.event == AuthChangeEvent.signedOut) recovering = false;
        notifyListeners();
      });
    } catch (e) {
      debugPrint('Supabase non inizializzato: $e');
    }
  }

  Future<void> continueAsGuest() async {
    guest = true;
    await (await SharedPreferences.getInstance()).setBool('ospite', true);
    notifyListeners();
  }

  /// Restituisce null se tutto ok, altrimenti il messaggio da mostrare.
  Future<String?> signIn(String email, String password) => _run(() async {
        await client!.auth.signInWithPassword(email: email.trim(), password: password);
        return null;
      });

  Future<String?> signUp({required String email, required String password, required String nome, String? telefono}) => _run(() async {
        final r = await client!.auth.signUp(
          email: email.trim(),
          password: password,
          emailRedirectTo: kIsWeb ? null : redirect,
          data: {'nome': nome.trim(), if (telefono != null && telefono.trim().isNotEmpty) 'telefono': telefono.trim()},
        );
        // se in Supabase è attiva la conferma email, la sessione arriva solo dopo il click sul link
        if (r.session == null) return 'conferma';
        return null;
      });

  Future<String?> resetPassword(String email) => _run(() async {
        await client!.auth.resetPasswordForEmail(email.trim(), redirectTo: kIsWeb ? null : redirect);
        return null;
      });

  Future<String?> setNewPassword(String password) => _run(() async {
        await client!.auth.updateUser(UserAttributes(password: password));
        recovering = false;
        notifyListeners();
        return null;
      });

  Future<void> signOut() async {
    guest = false;
    await (await SharedPreferences.getInstance()).setBool('ospite', false);
    if (client != null) await client!.auth.signOut();
    notifyListeners();
  }

  Future<String?> _run(Future<String?> Function() f) async {
    if (!configured || client == null) return 'Accesso non ancora attivo: manca il collegamento a Supabase.';
    try {
      return await f();
    } on AuthException catch (e) {
      return italian(e);
    } catch (e) {
      return 'Connessione non riuscita. Controlla internet e riprova.';
    }
  }

  /// Messaggi di Supabase tradotti in italiano.
  static String italian(AuthException e) {
    final m = e.message.toLowerCase(), c = e.code ?? '';
    if (c == 'invalid_credentials' || m.contains('invalid login')) return 'Email o password non corretti.';
    if (c == 'email_not_confirmed' || m.contains('not confirmed')) return 'Devi prima confermare la tua email: controlla la posta (anche lo spam).';
    if (c == 'user_already_exists' || m.contains('already registered')) return 'Esiste già un account con questa email. Prova ad accedere.';
    if (c == 'weak_password' || m.contains('password should be')) return 'Password troppo debole: usa almeno 8 caratteri.';
    if (c == 'over_email_send_rate_limit' || m.contains('rate limit')) return 'Troppi tentativi. Aspetta qualche minuto e riprova.';
    if (m.contains('invalid email') || c == 'email_address_invalid') return 'Indirizzo email non valido.';
    if (c == 'same_password') return 'La nuova password deve essere diversa da quella vecchia.';
    return 'Errore: ${e.message}';
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}
