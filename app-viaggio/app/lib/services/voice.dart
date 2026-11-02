import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:http/http.dart' as http;
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';

/// Guida vocale: voce ElevenLabs (molto umana) tramite la funzione Supabase "tts",
/// con cache sul telefono. Se manca internet o il servizio non risponde, usa la voce del telefono.
class VoiceService {
  VoiceService._();
  static final VoiceService instance = VoiceService._();

  final _player = AudioPlayer();
  final _tts = FlutterTts();
  bool _ttsReady = false;
  Future<void> _queue = Future.value();

  /// Voce ElevenLabs scelta nelle impostazioni (vuoto = voce predefinita del server).
  String voiceId = '';
  bool useElevenLabs = true;
  double volume = 1.0;

  Future<void> loadSettings() async {
    final p = await SharedPreferences.getInstance();
    voiceId = p.getString('voiceId') ?? '';
    useElevenLabs = p.getBool('useElevenLabs') ?? true;
  }

  Future<void> saveSettings() async {
    final p = await SharedPreferences.getInstance();
    await p.setString('voiceId', voiceId);
    await p.setBool('useElevenLabs', useElevenLabs);
  }

  bool get cloudAvailable => useElevenLabs && AppConfig.ttsUrl.isNotEmpty;

  /// Pronuncia [text]; gli annunci vengono messi in coda, mai sovrapposti.
  Future<void> say(String text) {
    final next = _queue.then((_) => _speak(text)).catchError((e) => debugPrint('voice: $e'));
    _queue = next;
    return next;
  }

  /// Prepara in anticipo gli annunci del viaggio (così funzionano anche senza rete durante il tragitto).
  Future<void> prefetch(Iterable<String> texts) async {
    if (!cloudAvailable || kIsWeb) return;
    for (final t in texts.toSet()) {
      try {
        await _cached(t);
      } catch (_) {
        return; // niente rete: si userà la voce del telefono
      }
    }
  }

  Future<void> stop() async {
    await _player.stop();
    await _tts.stop();
  }

  Future<void> _speak(String text) async {
    if (cloudAvailable) {
      try {
        if (kIsWeb) {
          await _player.setAudioSource(AudioSource.uri(Uri.dataFromBytes(await _fetch(text), mimeType: 'audio/mpeg')));
        } else {
          final f = await _cached(text);
          await _player.setFilePath(f.path);
        }
        await _player.setVolume(volume);
        final done = _player.playerStateStream.firstWhere((s) => s.processingState == ProcessingState.completed);
        await _player.play();
        await done.timeout(const Duration(seconds: 30), onTimeout: () => _player.playerState);
        return;
      } catch (e) {
        debugPrint('ElevenLabs non disponibile, uso la voce del telefono: $e');
      }
    }
    await _deviceSpeak(text);
  }

  Future<File> _cached(String text) async {
    final key = sha1.convert(utf8.encode('$voiceId|$text')).toString();
    final d = Directory('${(await getApplicationSupportDirectory()).path}/voce');
    await d.create(recursive: true);
    final f = File('${d.path}/$key.mp3');
    if (await f.exists() && await f.length() > 1000) return f;
    await f.writeAsBytes(await _fetch(text), flush: true);
    return f;
  }

  Future<List<int>> _fetch(String text) async {
    final r = await http
        .post(Uri.parse(AppConfig.ttsUrl),
            headers: {'content-type': 'application/json', ...AppConfig.supabaseHeaders},
            body: jsonEncode({'text': text, if (voiceId.isNotEmpty) 'voice_id': voiceId}))
        .timeout(const Duration(seconds: 20));
    if (r.statusCode != 200 || r.bodyBytes.length < 1000) throw Exception('tts ${r.statusCode}');
    return r.bodyBytes;
  }

  Future<void> _deviceSpeak(String text) async {
    if (!_ttsReady) {
      _ttsReady = true;
      await _tts.setLanguage('it-IT');
      await _tts.setSpeechRate(0.48);
      await _tts.setPitch(1.0);
      await _tts.awaitSpeakCompletion(true);
      // se il telefono ha voci italiane "migliorate"/neurali, scegli quella
      try {
        final voices = (await _tts.getVoices as List?) ?? [];
        final it = voices.whereType<Map>().where((v) => '${v['locale']}'.toLowerCase().startsWith('it')).toList();
        Map? best;
        for (final v in it) {
          final n = '${v['name']} ${v['quality'] ?? ''}'.toLowerCase();
          if (n.contains('enhanced') || n.contains('premium') || n.contains('network') || n.contains('neural')) best = v;
        }
        best ??= it.isNotEmpty ? it.first : null;
        if (best != null) await _tts.setVoice({'name': '${best['name']}', 'locale': '${best['locale']}'});
      } catch (_) {}
    }
    await _tts.setVolume(volume);
    // alcuni dispositivi/emulatori non hanno un motore vocale: non bloccare la coda degli annunci
    await _tts.speak(text).timeout(const Duration(seconds: 15), onTimeout: () => null);
  }
}
