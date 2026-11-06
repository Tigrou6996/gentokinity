import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/auth.dart';
import '../theme.dart';

/// Accesso e registrazione (Supabase Auth, email e password) in stile LBS.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _auth = AuthService.instance;
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController(), _pass = TextEditingController(), _nome = TextEditingController(), _tel = TextEditingController();
  bool _register = false, _hide = true, _privacy = false, _busy = false;
  String? _error, _info;

  @override
  void dispose() {
    for (final c in [_email, _pass, _nome, _tel]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _info = null;
    });
    if (!_form.currentState!.validate()) return;
    if (_register && !_privacy) {
      setState(() => _error = 'Per registrarti devi accettare l\'informativa sulla privacy.');
      return;
    }
    setState(() => _busy = true);
    final r = _register
        ? await _auth.signUp(email: _email.text, password: _pass.text, nome: _nome.text, telefono: _tel.text)
        : await _auth.signIn(_email.text, _pass.text);
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (r == 'conferma') {
        _info = 'Ti abbiamo mandato un\'email: apri il link per confermare l\'account, poi accedi.';
        _register = false;
      } else {
        _error = r;
      }
    });
  }

  Future<void> _forgot() async {
    final ctl = TextEditingController(text: _email.text);
    final email = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Password dimenticata'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Scrivi la tua email: ti mandiamo un link per scegliere una nuova password.'),
          const SizedBox(height: 14),
          TextField(controller: ctl, keyboardType: TextInputType.emailAddress, autofocus: true, decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.mail_outline_rounded))),
        ]),
        actions: [TextButton(onPressed: () => Navigator.pop(c), child: const Text('Annulla')), FilledButton(onPressed: () => Navigator.pop(c, ctl.text), child: const Text('Invia'))],
      ),
    );
    ctl.dispose();
    if (email == null || !email.contains('@')) return;
    setState(() => _busy = true);
    final r = await _auth.resetPassword(email);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _error = r;
      _info = r == null ? 'Se l\'email è registrata, riceverai a breve il link per la nuova password.' : null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final ready = _auth.configured;
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        // intestazione viola con logo e motivo LBS
        Stack(children: [
          const Positioned.fill(child: BrandPattern(radius: BorderRadius.vertical(bottom: Radius.circular(32)))),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 40),
              child: Column(children: [
                const LbsLogo(size: 92),
                const SizedBox(height: 16),
                const Text('LBS Viaggio', style: TextStyle(fontFamily: 'PlusJakartaSans', fontWeight: FontWeight.w800, fontSize: 28, color: Colors.white)),
                const SizedBox(height: 6),
                Text(_register ? 'Crea il tuo account' : 'Bentornato! Accedi per ritrovare i tuoi viaggi',
                    textAlign: TextAlign.center, style: const TextStyle(fontSize: 15, color: Color(0xFFEBD9FB))),
              ]),
            ),
          ),
        ]),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
          child: Form(
            key: _form,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (!ready)
                _Notice(Icons.info_outline_rounded, 'Accesso non ancora collegato a Supabase. Per ora puoi usare l\'app senza account.', const Color(0xFFFFF4D6), const Color(0xFF7A5300)),
              SegmentedButton<bool>(
                segments: const [ButtonSegment(value: false, label: Text('Accedi')), ButtonSegment(value: true, label: Text('Registrati'))],
                selected: {_register},
                showSelectedIcon: false,
                style: ButtonStyle(
                  backgroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? kPurple : Colors.white),
                  foregroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Colors.white : kPurple),
                  textStyle: const WidgetStatePropertyAll(TextStyle(fontFamily: 'PlusJakartaSans', fontWeight: FontWeight.w800, fontSize: 15)),
                  minimumSize: const WidgetStatePropertyAll(Size(0, 48)),
                ),
                onSelectionChanged: (v) => setState(() {
                  _register = v.first;
                  _error = null;
                  _info = null;
                }),
              ),
              const SizedBox(height: 18),
              if (_register) ...[
                TextFormField(
                  controller: _nome,
                  textCapitalization: TextCapitalization.words,
                  autofillHints: const [AutofillHints.name],
                  decoration: const InputDecoration(labelText: 'Nome e cognome', prefixIcon: Icon(Icons.person_outline_rounded)),
                  validator: (v) => (v ?? '').trim().length < 2 ? 'Scrivi il tuo nome' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _tel,
                  keyboardType: TextInputType.phone,
                  autofillHints: const [AutofillHints.telephoneNumber],
                  decoration: const InputDecoration(labelText: 'Telefono / WhatsApp (facoltativo)', prefixIcon: Icon(Icons.phone_outlined)),
                ),
                const SizedBox(height: 12),
              ],
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.mail_outline_rounded)),
                validator: (v) => RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch((v ?? '').trim()) ? null : 'Email non valida',
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _pass,
                obscureText: _hide,
                autofillHints: [_register ? AutofillHints.newPassword : AutofillHints.password],
                onFieldSubmitted: (_) => _submit(),
                decoration: InputDecoration(
                  labelText: 'Password',
                  helperText: _register ? 'Almeno 8 caratteri' : null,
                  prefixIcon: const Icon(Icons.lock_outline_rounded),
                  suffixIcon: IconButton(icon: Icon(_hide ? Icons.visibility_outlined : Icons.visibility_off_outlined), onPressed: () => setState(() => _hide = !_hide)),
                ),
                validator: (v) => (v ?? '').length < (_register ? 8 : 1) ? (_register ? 'Almeno 8 caratteri' : 'Scrivi la password') : null,
              ),
              if (!_register)
                Align(alignment: Alignment.centerRight, child: TextButton(onPressed: ready && !_busy ? _forgot : null, child: const Text('Password dimenticata?'))),
              if (_register)
                CheckboxListTile(
                  value: _privacy,
                  onChanged: (v) => setState(() => _privacy = v ?? false),
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  activeColor: kPurple,
                  title: Text.rich(TextSpan(children: [
                    const TextSpan(text: 'Accetto l\''),
                    WidgetSpan(
                      alignment: PlaceholderAlignment.baseline,
                      baseline: TextBaseline.alphabetic,
                      child: GestureDetector(
                        onTap: () => launchUrl(Uri.parse('https://www.lbswork.com/privacy-policy'), mode: LaunchMode.externalApplication),
                        child: const Text('informativa sulla privacy', style: TextStyle(color: kPurple, fontWeight: FontWeight.w700, decoration: TextDecoration.underline)),
                      ),
                    ),
                  ]), style: const TextStyle(fontSize: 14)),
                ),
              if (_error != null) _Notice(Icons.error_outline_rounded, _error!, const Color(0xFFFDECEC), kRed),
              if (_info != null) _Notice(Icons.mark_email_read_outlined, _info!, const Color(0xFFEAFAF1), const Color(0xFF1E7A47)),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: ready && !_busy ? _submit : null,
                child: _busy
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                    : Text(_register ? 'Crea account' : 'Accedi'),
              ),
              const SizedBox(height: 18),
              Row(children: const [Expanded(child: Divider()), Padding(padding: EdgeInsets.symmetric(horizontal: 10), child: Text('oppure', style: TextStyle(color: kMuted))), Expanded(child: Divider())]),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: _busy ? null : _auth.continueAsGuest,
                icon: const Icon(Icons.explore_outlined),
                label: const Text('Continua senza account'),
              ),
              const SizedBox(height: 8),
              const Text('Senza account i viaggi restano solo su questo telefono.', textAlign: TextAlign.center, style: TextStyle(color: kMuted, fontSize: 13)),
            ]),
          ),
        ),
      ]),
    );
  }
}

/// Dopo il link "password dimenticata": scelta della nuova password.
class NewPasswordScreen extends StatefulWidget {
  const NewPasswordScreen({super.key});
  @override
  State<NewPasswordScreen> createState() => _NewPasswordScreenState();
}

class _NewPasswordScreenState extends State<NewPasswordScreen> {
  final _p1 = TextEditingController(), _p2 = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _p1.dispose();
    _p2.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_p1.text.length < 8) return setState(() => _error = 'Almeno 8 caratteri.');
    if (_p1.text != _p2.text) return setState(() => _error = 'Le due password non coincidono.');
    setState(() => _busy = true);
    final r = await AuthService.instance.setNewPassword(_p1.text);
    if (mounted) setState(() => (_busy = false, _error = r));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: lbsBar(title: const Text('Nuova password')),
        body: ListView(padding: const EdgeInsets.all(16), children: [
          const Text('Scegli una nuova password per il tuo account.', style: TextStyle(fontSize: 16)),
          const SizedBox(height: 16),
          TextField(controller: _p1, obscureText: true, decoration: const InputDecoration(labelText: 'Nuova password', prefixIcon: Icon(Icons.lock_outline_rounded))),
          const SizedBox(height: 12),
          TextField(controller: _p2, obscureText: true, decoration: const InputDecoration(labelText: 'Ripeti la password', prefixIcon: Icon(Icons.lock_outline_rounded))),
          if (_error != null) _Notice(Icons.error_outline_rounded, _error!, const Color(0xFFFDECEC), kRed),
          const SizedBox(height: 16),
          FilledButton(onPressed: _busy ? null : _save, child: const Text('Salva password')),
        ]),
      );
}

class _Notice extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color bg, fg;
  const _Notice(this.icon, this.text, this.bg, this.fg);
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(top: 10, bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, color: fg, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: TextStyle(color: fg, fontWeight: FontWeight.w600))),
        ]),
      );
}
