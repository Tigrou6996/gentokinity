import 'package:flutter/material.dart';
import '../config.dart';
import '../services/voice.dart';
import '../theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final v = VoiceService.instance;
  late final _voice = TextEditingController(text: v.voiceId);
  bool _testing = false;

  @override
  void dispose() {
    _voice.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    v.voiceId = _voice.text.trim();
    await v.saveSettings();
  }

  Future<void> _test() async {
    setState(() => _testing = true);
    await _save();
    await v.say('Prossima fermata: Kassel Hauptbahnhof. Scendi qui.');
    if (mounted) setState(() => _testing = false);
  }

  @override
  Widget build(BuildContext context) {
    final cloud = AppConfig.ttsUrl.isNotEmpty;
    return Scaffold(
      appBar: lbsBar(title: const Text('Impostazioni')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        const Text('GUIDA VOCALE', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1.4, fontSize: 12, color: Colors.black54)),
        const SizedBox(height: 8),
        Card(
          child: Column(children: [
            SwitchListTile(
              value: v.useElevenLabs && cloud,
              onChanged: cloud
                  ? (x) async {
                      setState(() => v.useElevenLabs = x);
                      await v.saveSettings();
                    }
                  : null,
              title: const Text('Voce naturale (ElevenLabs)', style: TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(cloud ? 'Molto umana. Senza internet si usa la voce del telefono.' : 'Non configurata: si usa la voce del telefono.'),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: TextField(
                controller: _voice,
                enabled: cloud && v.useElevenLabs,
                onSubmitted: (_) => _save(),
                decoration: const InputDecoration(labelText: 'ID della voce ElevenLabs (facoltativo)', helperText: 'Vuoto = voce predefinita del server'),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: _testing ? null : _test,
          icon: const Icon(Icons.volume_up_rounded),
          label: Text(_testing ? 'Ascolta…' : 'Prova la voce'),
        ),
        const SizedBox(height: 28),
        const Text('INFORMAZIONI', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1.4, fontSize: 12, color: Colors.black54)),
        const SizedBox(height: 8),
        Card(
          child: Column(children: [
            ListTile(leading: const Icon(Icons.dns_rounded, color: kPurple), title: const Text('Orari e fermate'), subtitle: Text(AppConfig.transitBase)),
            const ListTile(
              leading: Icon(Icons.lock_rounded, color: kPurple),
              title: Text('Privacy'),
              subtitle: Text('Il biglietto viene letto sul telefono e resta salvato solo qui. La posizione serve solo per la guida vocale.'),
            ),
          ]),
        ),
      ]),
    );
  }
}
