import '../models/transit.dart';
import '../models/trip.dart';

/// Viaggio di esempio (Kassel → Göttingen, bus + treno) per provare l'app senza biglietto, senza rete
/// e senza chiavi. Parte tra un minuto: con la guida vocale "simulata" il tempo scorre più veloce.
class Demo {
  static const idPrefix = 'demo-';

  static bool isDemo(SavedTrip t) => t.id.startsWith(idPrefix);

  static SavedTrip trip() {
    final t0 = DateTime.now().add(const Duration(minutes: 1));
    String iso(int min) => t0.add(Duration(minutes: min)).toUtc().toIso8601String();
    Map<String, dynamic> stop(String id, String name, double lat, double lon) =>
        {'type': 'stop', 'id': id, 'name': name, 'location': {'latitude': lat, 'longitude': lon}};
    Map<String, dynamic> so(Map<String, dynamic> s, int min, [String? platform]) =>
        {'stop': s, 'arrival': iso(min), 'plannedArrival': iso(min), 'departure': iso(min), 'plannedDeparture': iso(min), 'departurePlatform': platform};

    final wil = stop('d1', 'Kassel-Wilhelmshöhe', 51.3131, 9.4469), beb = stop('d2', 'Bebelplatz', 51.3150, 9.4690);
    final rat = stop('d3', 'Rathaus', 51.3127, 9.4911), hbf = stop('d4', 'Kassel Hauptbahnhof', 51.3183, 9.4892);
    final ihr = stop('d5', 'Fuldatal-Ihringshausen', 51.3600, 9.5330), mue = stop('d6', 'Hann. Münden', 51.4167, 9.6500);
    final eic = stop('d7', 'Eichenberg', 51.3769, 9.9119), fri = stop('d8', 'Friedland (Han)', 51.4200, 9.9200);
    final goe = stop('d9', 'Göttingen', 51.5363, 9.9268);

    final raw = {
      'legs': [
        {
          'origin': wil, 'destination': hbf,
          'departure': iso(0), 'plannedDeparture': iso(0), 'arrival': iso(9), 'plannedArrival': iso(9),
          'departurePlatform': 'B', 'line': {'name': 'Bus 42', 'product': 'bus'}, 'direction': 'Hauptbahnhof',
          'stopovers': [so(wil, 0, 'B'), so(beb, 3), so(rat, 6), so(hbf, 9)],
        },
        {'origin': hbf, 'destination': hbf, 'walking': true, 'departure': iso(9), 'arrival': iso(12), 'distance': 180},
        {
          'origin': hbf, 'destination': goe,
          'departure': iso(16), 'plannedDeparture': iso(14), 'arrival': iso(58), 'plannedArrival': iso(56),
          'departurePlatform': '4', 'arrivalPlatform': '7', 'line': {'name': 'RE 5', 'product': 'regional'}, 'direction': 'Göttingen',
          'stopovers': [so(hbf, 16, '4'), so(ihr, 24), so(mue, 33), so(eic, 42), so(fri, 50), so(goe, 58, '7')],
          'remarks': [{'type': 'warning', 'summary': 'Esempio: partenza in ritardo di 2 minuti'}],
        },
      ],
    };
    final j = Journey.fromJson(raw);
    return SavedTrip(
      id: '$idPrefix${DateTime.now().millisecondsSinceEpoch}',
      ticket: TicketInfo(operator: 'Viaggio di esempio', from: 'Kassel-Wilhelmshöhe', to: 'Göttingen', code: 'ESEMPIO-LBS-0001'),
      journey: j,
      from: Place.fromJson(wil),
      to: Place.fromJson(goe),
      createdAt: DateTime.now(),
    );
  }
}
