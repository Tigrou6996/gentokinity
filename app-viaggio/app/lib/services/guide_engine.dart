import 'dart:math' as math;
import 'package:intl/intl.dart';
import '../models/transit.dart';

enum GuideEventKind { boarding, nextStop, getOffSoon, getOff, transfer, arrived }

class GuideEvent {
  final GuideEventKind kind;
  final String text; // frase da pronunciare
  final int ride; // indice del mezzo (tra quelli non a piedi)
  final int stop; // indice della fermata nel tratto
  const GuideEvent(this.kind, this.text, this.ride, this.stop);
  @override
  String toString() => '$kind($ride,$stop): $text';
}

/// Stato attuale mostrato a schermo.
class GuideStatus {
  final int ride; // mezzo corrente (-1 = non ancora partito)
  final int nextStop; // indice della prossima fermata nel mezzo corrente
  final String headline; // es. "Prossima fermata"
  final String stopName;
  final DateTime? at;
  const GuideStatus(this.ride, this.nextStop, this.headline, this.stopName, this.at);
}

/// Logica della guida vocale, senza dipendenze dal telefono (testabile).
/// Si basa sulla posizione GPS quando c'è, altrimenti sugli orari (con i ritardi in tempo reale).
class GuideEngine {
  final Journey journey;
  GuideEngine(this.journey);

  static const nearStop = 130.0; // m: sei alla fermata
  static const leftStop = 220.0; // m: sei ripartito
  static const approach = 450.0; // m: avviso "preparati a scendere"

  int _ride = -1; // mezzo su cui sei
  int _passed = -1; // ultima fermata superata nel mezzo corrente
  bool _atStop = false;
  final Set<String> _said = {};

  final _hm = DateFormat('HH:mm');
  List<Leg> get rides => journey.rides;

  GuideStatus get status {
    final r = rides;
    if (r.isEmpty) return const GuideStatus(-1, 0, 'Viaggio', '', null);
    if (_ride < 0) {
      final l = r.first;
      return GuideStatus(-1, 0, 'Prendi ${l.line?.spoken ?? 'il mezzo'}', l.origin.name, l.dep);
    }
    if (_ride >= r.length) return GuideStatus(r.length, 0, 'Sei arrivato', r.last.destination.name, r.last.arr);
    final stops = r[_ride].stops;
    final n = (_passed + 1).clamp(0, stops.length - 1);
    final last = n == stops.length - 1;
    return GuideStatus(_ride, n, last ? 'Scendi alla prossima' : 'Prossima fermata', stops[n].stop.name, stops[n].when);
  }

  /// Da chiamare a ogni nuova posizione GPS o ogni ~10 secondi. Restituisce gli annunci da fare.
  List<GuideEvent> update(DateTime now, LatLon? pos) {
    final out = <GuideEvent>[];
    final r = rides;
    if (r.isEmpty) return out;
    void emit(GuideEvent e) {
      final k = '${e.kind}-${e.ride}-${e.stop}';
      if (_said.add(k)) out.add(e);
    }

    // 1) quale mezzo? il primo non ancora concluso
    if (_ride < 0) {
      final d = r.first.dep;
      if (d != null && now.isAfter(d.subtract(const Duration(seconds: 30)))) {
        _ride = 0;
        _passed = -1;
      } else if (d != null && now.isAfter(d.subtract(const Duration(minutes: 6)))) {
        emit(GuideEvent(GuideEventKind.boarding, _boardingText(0), 0, 0));
      }
    }
    if (_ride < 0) return out;
    while (_ride < r.length) {
      final leg = r[_ride], stops = leg.stops;
      final arr = leg.arr;
      final arrived = _passed >= stops.length - 1 ||
          (pos != null && stops.last.stop.location != null && _dist(pos, stops.last.stop.location!) < nearStop && _passed >= stops.length - 2) ||
          (arr != null && now.isAfter(arr.add(const Duration(seconds: 45))));
      if (!arrived) break;
      if (_ride == r.length - 1) {
        emit(GuideEvent(GuideEventKind.arrived, 'Sei arrivato a ${leg.destination.name}. Buon lavoro!', _ride, stops.length - 1));
        _ride = r.length;
        return out;
      }
      _ride++;
      _passed = -1;
      _atStop = false;
      final next = r[_ride], dep = next.dep;
      if (dep == null || now.isBefore(dep)) emit(GuideEvent(GuideEventKind.transfer, _boardingText(_ride), _ride, 0));
    }
    if (_ride >= r.length) return out;

    final leg = r[_ride], stops = leg.stops;

    // 2) fermate superate: con il GPS (vicino a una fermata e poi ripartito) o con gli orari
    if (pos != null) {
      var best = -1;
      var bestD = double.infinity;
      for (var i = math.max(0, _passed); i < stops.length; i++) {
        final l = stops[i].stop.location;
        if (l == null) continue;
        final dd = _dist(pos, l);
        if (dd < bestD) {
          bestD = dd;
          best = i;
        }
      }
      if (best >= 0 && bestD < nearStop) {
        _atStop = true;
        if (best - 1 > _passed) _passed = best - 1; // fermate saltate senza segnale
        _atStopIndex = best;
      } else if (_atStop && best >= 0 && bestD > leftStop) {
        _atStop = false;
        if (_atStopIndex > _passed) _passed = _atStopIndex;
      }
    }
    // gli orari fanno da riserva (e correggono un GPS assente o impreciso)
    for (var i = _passed + 1; i < stops.length - 1; i++) {
      final t = stops[i].leaves;
      if (t != null && now.isAfter(t.add(const Duration(seconds: 40)))) {
        _passed = i;
      } else {
        break;
      }
    }
    if (_passed < 0) {
      final t = stops.first.leaves;
      if (t != null && now.isAfter(t.add(const Duration(seconds: 20)))) _passed = 0;
    }

    // 3) annunci
    if (_passed >= 0 && _passed < stops.length - 1) {
      final n = _passed + 1, last = n == stops.length - 1;
      final name = stops[n].stop.name;
      if (last) {
        final more = _ride < r.length - 1 ? ' Poi cambi.' : '';
        emit(GuideEvent(GuideEventKind.nextStop, 'Prossima fermata: $name. Scendi qui.$more', _ride, n));
        final l = stops[n].stop.location, t = stops[n].when;
        final close = (pos != null && l != null && _dist(pos, l) < approach) || (t != null && now.isAfter(t.subtract(const Duration(seconds: 75))));
        if (close) emit(GuideEvent(GuideEventKind.getOffSoon, 'Stai arrivando a $name. Preparati a scendere.', _ride, n));
      } else {
        emit(GuideEvent(GuideEventKind.nextStop, 'Prossima fermata: $name.', _ride, n));
      }
    }
    return out;
  }

  int _atStopIndex = 0;

  String _boardingText(int i) {
    final l = rides[i];
    final what = l.line?.spoken ?? 'il mezzo';
    final dir = l.direction != null ? ', direzione ${l.direction}' : '';
    final at = l.dep != null ? ' alle ${_hm.format(l.dep!)}' : '';
    final pl = l.departurePlatform != null ? ', ${l.line?.product == 'bus' ? 'fermata' : 'binario'} ${l.departurePlatform}' : '';
    final pre = i == 0 ? 'Il tuo viaggio sta per iniziare. ' : 'Cambio. ';
    return '${pre}Prendi $what$dir$at, da ${l.origin.name}$pl.';
  }

  /// Tutte le frasi che potrebbero servire (per prepararle prima di partire).
  List<String> allPhrases() {
    final out = <String>[];
    final r = rides;
    for (var i = 0; i < r.length; i++) {
      out.add(_boardingText(i));
      final s = r[i].stops;
      for (var n = 1; n < s.length; n++) {
        final name = s[n].stop.name;
        if (n == s.length - 1) {
          out.add('Prossima fermata: $name. Scendi qui.${i < r.length - 1 ? ' Poi cambi.' : ''}');
          out.add('Stai arrivando a $name. Preparati a scendere.');
        } else {
          out.add('Prossima fermata: $name.');
        }
      }
    }
    if (r.isNotEmpty) out.add('Sei arrivato a ${r.last.destination.name}. Buon lavoro!');
    return out;
  }

  static double _dist(LatLon a, LatLon b) {
    const R = 6371000.0;
    final dLat = (b.lat - a.lat) * math.pi / 180, dLon = (b.lon - a.lon) * math.pi / 180;
    final h = math.pow(math.sin(dLat / 2), 2) + math.cos(a.lat * math.pi / 180) * math.cos(b.lat * math.pi / 180) * math.pow(math.sin(dLon / 2), 2);
    return 2 * R * math.asin(math.sqrt(h));
  }
}
