import 'package:flutter_test/flutter_test.dart';
import 'package:lbs_viaggio/models/transit.dart';
import 'package:lbs_viaggio/services/guide_engine.dart';

Map<String, dynamic> stop(String id, String name, double lat, double lon) => {'type': 'stop', 'id': id, 'name': name, 'location': {'latitude': lat, 'longitude': lon}};
String iso(DateTime d) => d.toUtc().toIso8601String();

/// Bus 42 con 4 fermate (A, B, C, D) e poi un treno RE 5 da D a E.
Journey sample(DateTime t0) {
  final a = stop('1', 'Wilhelmshöhe', 51.3130, 9.4470), b = stop('2', 'Kirchweg', 51.3150, 9.4600), c = stop('3', 'Rathaus', 51.3170, 9.4730), d = stop('4', 'Hauptbahnhof', 51.3190, 9.4890);
  final e = stop('5', 'Göttingen', 51.5363, 9.9268);
  Map<String, dynamic> so(Map<String, dynamic> s, int min) => {'stop': s, 'arrival': iso(t0.add(Duration(minutes: min))), 'plannedArrival': iso(t0.add(Duration(minutes: min))), 'departure': iso(t0.add(Duration(minutes: min))), 'plannedDeparture': iso(t0.add(Duration(minutes: min)))};
  return Journey.fromJson({
    'legs': [
      {
        'origin': a, 'destination': d,
        'departure': iso(t0), 'plannedDeparture': iso(t0), 'arrival': iso(t0.add(const Duration(minutes: 9))), 'plannedArrival': iso(t0.add(const Duration(minutes: 9))),
        'line': {'name': 'Bus 42', 'product': 'bus'}, 'direction': 'Hauptbahnhof', 'departurePlatform': 'B',
        'stopovers': [so(a, 0), so(b, 3), so(c, 6), so(d, 9)],
      },
      {'origin': d, 'destination': d, 'walking': true, 'departure': iso(t0.add(const Duration(minutes: 9))), 'arrival': iso(t0.add(const Duration(minutes: 12))), 'distance': 150},
      {
        'origin': d, 'destination': e,
        'departure': iso(t0.add(const Duration(minutes: 16))), 'plannedDeparture': iso(t0.add(const Duration(minutes: 16))),
        'arrival': iso(t0.add(const Duration(minutes: 60))), 'plannedArrival': iso(t0.add(const Duration(minutes: 60))),
        'line': {'name': 'RE 5', 'product': 'regional'}, 'direction': 'Göttingen', 'departurePlatform': '4',
        'stopovers': [so(d, 16), so(e, 60)],
      },
    ],
  });
}

void main() {
  final t0 = DateTime(2026, 11, 12, 8, 0);

  test('modello: mezzi, cambi e minuti di cambio', () {
    final j = sample(t0);
    expect(j.rides.length, 2);
    expect(j.changes, 1);
    expect(j.transferMinutes(0), 7);
    expect(j.rides.first.line!.spoken, 'il bus 42');
    expect(j.rides.last.line!.spoken, 'il treno RE 5');
  });

  test('solo orari (senza GPS): avvisi in ordine, una volta sola', () {
    final g = GuideEngine(sample(t0));
    final said = <String>[];
    for (var m = -8.0; m <= 62; m += 0.25) {
      said.addAll(g.update(t0.add(Duration(seconds: (m * 60).round())), null).map((e) => e.text));
    }
    expect(said.first, startsWith('Il tuo viaggio sta per iniziare. Prendi il bus 42, direzione Hauptbahnhof alle 08:00, da Wilhelmshöhe, fermata B.'));
    int idx(String s) => said.indexWhere((x) => x.startsWith(s));
    expect(idx('Prossima fermata: Kirchweg.'), greaterThan(0));
    expect(idx('Prossima fermata: Rathaus.'), greaterThan(idx('Prossima fermata: Kirchweg.')));
    expect(idx('Prossima fermata: Hauptbahnhof. Scendi qui. Poi cambi.'), greaterThan(idx('Prossima fermata: Rathaus.')));
    expect(idx('Stai arrivando a Hauptbahnhof.'), greaterThan(idx('Prossima fermata: Hauptbahnhof.')));
    expect(idx('Cambio. Prendi il treno RE 5'), greaterThan(idx('Stai arrivando a Hauptbahnhof.')));
    expect(idx('Prossima fermata: Göttingen. Scendi qui.'), greaterThan(idx('Cambio.')));
    expect(said.last, 'Sei arrivato a Göttingen. Buon lavoro!');
    expect(said.toSet().length, said.length, reason: 'nessun annuncio ripetuto');
  });

  test('con il GPS: la fermata superata la decide la posizione, anche in ritardo sugli orari', () {
    final g = GuideEngine(sample(t0));
    // sei alla prima fermata, il bus parte in ritardo: gli orari direbbero che hai già passato Kirchweg
    expect(g.update(t0.subtract(const Duration(minutes: 3)), const LatLon(51.3130, 9.4470)).single.kind, GuideEventKind.boarding);
    g.update(t0.add(const Duration(seconds: 10)), const LatLon(51.3130, 9.4470));
    final ev = g.update(t0.add(const Duration(minutes: 1)), const LatLon(51.3141, 9.4535)); // a metà strada
    expect(ev.map((e) => e.text), contains('Prossima fermata: Kirchweg.'));
    expect(g.status.stopName, 'Kirchweg');
    // arrivi a Kirchweg e riparti
    g.update(t0.add(const Duration(minutes: 3)), const LatLon(51.3150, 9.4600));
    final ev2 = g.update(t0.add(const Duration(minutes: 4)), const LatLon(51.3161, 9.4670));
    expect(ev2.map((e) => e.text), contains('Prossima fermata: Rathaus.'));
  });

  test('frasi da preparare in anticipo', () {
    final p = GuideEngine(sample(t0)).allPhrases();
    expect(p, contains('Prossima fermata: Rathaus.'));
    expect(p, contains('Stai arrivando a Göttingen. Preparati a scendere.'));
    expect(p.last, 'Sei arrivato a Göttingen. Buon lavoro!');
  });
}
