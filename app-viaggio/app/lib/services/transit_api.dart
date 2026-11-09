import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/transit.dart';

class TransitException implements Exception {
  final String message;
  TransitException(this.message);
  @override
  String toString() => message;
}

/// Client per orari, coincidenze e fermate (API compatibile con db-rest).
class TransitApi {
  final http.Client _http;
  final String base;
  TransitApi({http.Client? client, String? baseUrl})
      : _http = client ?? http.Client(),
        base = baseUrl ?? AppConfig.transitBase;

  Future<dynamic> _get(String path, Map<String, String> q) async {
    final uri = Uri.parse('$base$path').replace(queryParameters: q.isEmpty ? null : q);
    final http.Response r;
    try {
      r = await _http.get(uri, headers: {'accept': 'application/json', ...AppConfig.supabaseHeaders}).timeout(const Duration(seconds: 25));
    } catch (_) {
      throw TransitException('Connessione non riuscita. Controlla internet e riprova.');
    }
    if (r.statusCode != 200) {
      throw TransitException(r.statusCode >= 500 ? 'Il servizio orari non risponde, riprova tra poco.' : 'Richiesta non valida (${r.statusCode}).');
    }
    return jsonDecode(utf8.decode(r.bodyBytes));
  }

  /// Cerca fermate, stazioni e indirizzi.
  Future<List<Place>> searchPlaces(String query, {int results = 8}) async {
    if (query.trim().length < 2) return [];
    final j = await _get('/locations', {'query': query.trim(), 'results': '$results'});
    return (j as List).whereType<Map>().map((m) => Place.fromJson(Map<String, dynamic>.from(m))).where((p) => p.location != null || p.id != null).toList();
  }

  /// Fermate vicine a un punto.
  Future<List<Place>> nearbyStops(LatLon p, {int results = 10}) async {
    final j = await _get('/locations/nearby', {'latitude': '${p.lat}', 'longitude': '${p.lon}', 'results': '$results'});
    return (j as List).whereType<Map>().map((m) => Place.fromJson(Map<String, dynamic>.from(m))).toList();
  }

  /// Soluzioni di viaggio, con tutte le fermate intermedie e il percorso sulla mappa.
  Future<List<Journey>> journeys(Place from, Place to, {DateTime? departure, int results = 5}) async {
    final q = {
      ...from.asQuery('from'),
      ...to.asQuery('to'),
      'departure': (departure ?? DateTime.now()).toUtc().toIso8601String(),
      'results': '$results',
      'stopovers': 'true',
      'polylines': 'true',
      'remarks': 'true',
      'language': 'de',
    };
    final j = await _get('/journeys', q);
    final list = (j is Map ? j['journeys'] : null) as List? ?? [];
    return list.whereType<Map>().map((m) => Journey.fromJson(Map<String, dynamic>.from(m))).toList();
  }

  /// Aggiorna una soluzione salvata (ritardi, binari, cancellazioni) con il suo refreshToken.
  Future<Journey?> refresh(Journey j) async {
    final t = j.refreshToken;
    if (t == null) return null;
    final r = await _get('/journeys/${Uri.encodeComponent(t)}', {'stopovers': 'true', 'polylines': 'true', 'remarks': 'true', 'language': 'de'});
    final m = (r is Map && r['journey'] is Map) ? r['journey'] : r;
    if (m is! Map || m['legs'] is! List) return null;
    return Journey.fromJson(Map<String, dynamic>.from(m));
  }

  /// Aggiorna un tratto (ritardi, binario) tramite il suo tripId.
  Future<Leg?> trip(String tripId) async {
    final j = await _get('/trips/${Uri.encodeComponent(tripId)}', {'stopovers': 'true', 'polyline': 'true', 'remarks': 'true', 'language': 'de'});
    final t = (j is Map && j['trip'] is Map) ? j['trip'] : j;
    if (t is! Map || t['origin'] == null) return null;
    return Leg.fromJson(Map<String, dynamic>.from(t));
  }

  /// Prossime partenze da una fermata.
  Future<List<Departure>> departures(String stopId, {int minutes = 60}) async {
    final j = await _get('/stops/${Uri.encodeComponent(stopId)}/departures', {'duration': '$minutes', 'results': '30', 'remarks': 'false'});
    final list = (j is Map ? j['departures'] : j) as List? ?? [];
    return list.whereType<Map>().map((m) => Departure.fromJson(Map<String, dynamic>.from(m))).toList();
  }
}
