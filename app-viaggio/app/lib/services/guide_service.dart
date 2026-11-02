import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import '../models/transit.dart';
import 'guide_engine.dart';
import 'voice.dart';

/// Guida vocale attiva: segue la posizione (anche a schermo spento, con una notifica fissa su Android)
/// e annuncia la prossima fermata.
class GuideService extends ChangeNotifier {
  GuideService._();
  static final GuideService instance = GuideService._();

  GuideEngine? _engine;
  String? tripId;
  StreamSubscription<Position>? _sub;
  Timer? _timer;
  LatLon? position;
  final List<GuideEvent> log = [];

  bool get active => _engine != null;
  GuideStatus? get status => _engine?.status;

  /// Restituisce un messaggio di errore da mostrare, oppure null se tutto ok.
  Future<String?> start(String id, Journey journey) async {
    await stop();
    final perm = await _permission();
    _engine = GuideEngine(journey);
    tripId = id;
    log.clear();
    notifyListeners();

    // prepara le frasi mentre c'è ancora rete
    unawaited(VoiceService.instance.prefetch(_engine!.allPhrases()));
    await VoiceService.instance.say('Guida vocale attiva. Ti avviso prima di ogni fermata.');

    if (perm == null) {
      final settings = Platform.isAndroid
          ? AndroidSettings(
              accuracy: LocationAccuracy.high,
              distanceFilter: 15,
              intervalDuration: const Duration(seconds: 4),
              foregroundNotificationConfig: const ForegroundNotificationConfig(
                notificationTitle: 'Guida vocale attiva',
                notificationText: 'Ti avviso alla prossima fermata',
                enableWakeLock: true,
                setOngoing: true,
              ),
            )
          : Platform.isIOS
              ? AppleSettings(
                  accuracy: LocationAccuracy.best,
                  distanceFilter: 15,
                  activityType: ActivityType.otherNavigation,
                  pauseLocationUpdatesAutomatically: false,
                  showBackgroundLocationIndicator: true,
                  allowBackgroundLocationUpdates: true,
                )
              : const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 15);
      _sub = Geolocator.getPositionStream(locationSettings: settings).listen((p) {
        position = LatLon(p.latitude, p.longitude);
        _tick();
      }, onError: (e) => debugPrint('gps: $e'));
    }
    // controllo a tempo: funziona anche senza GPS (in galleria, in metropolitana)
    _timer = Timer.periodic(const Duration(seconds: 10), (_) => _tick());
    _tick();
    return perm;
  }

  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
    _timer?.cancel();
    _timer = null;
    final was = _engine != null;
    _engine = null;
    tripId = null;
    if (was) {
      await VoiceService.instance.stop();
      notifyListeners();
    }
  }

  /// Aggiorna gli orari (ritardi) senza perdere lo stato della guida.
  void replaceJourney(Journey j) {
    if (_engine == null) return;
    _engine = GuideEngine(j)..update(DateTime.now(), position);
    notifyListeners();
  }

  void _tick() {
    final e = _engine;
    if (e == null) return;
    final events = e.update(DateTime.now(), position);
    for (final ev in events) {
      log.insert(0, ev);
      VoiceService.instance.say(ev.text);
    }
    if (events.any((x) => x.kind == GuideEventKind.arrived)) {
      Timer(const Duration(seconds: 8), stop);
    }
    notifyListeners();
  }

  Future<String?> _permission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return 'GPS spento: la guida userà solo gli orari.';
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
    if (p == LocationPermission.denied || p == LocationPermission.deniedForever) {
      return 'Senza permesso di posizione la guida userà solo gli orari.';
    }
    return null;
  }
}
