// Modelli del trasporto pubblico nel formato FPTF usato da db-rest / db-vendo-client.

class LatLon {
  final double lat, lon;
  const LatLon(this.lat, this.lon);
  Map<String, dynamic> toJson() => {'latitude': lat, 'longitude': lon};
  static LatLon? fromJson(dynamic j) {
    if (j is! Map) return null;
    final la = j['latitude'], lo = j['longitude'];
    if (la is! num || lo is! num) return null;
    return LatLon(la.toDouble(), lo.toDouble());
  }
}

/// Una fermata/stazione, un indirizzo o un punto qualsiasi.
class Place {
  final String? id;
  final String name;
  final String type; // stop | station | location
  final LatLon? location;
  const Place({this.id, required this.name, this.type = 'stop', this.location});

  bool get isStop => type == 'stop' || type == 'station';

  factory Place.fromJson(Map<String, dynamic> j) {
    final loc = LatLon.fromJson(j['location']) ?? LatLon.fromJson(j);
    final name = (j['name'] ?? j['address'] ?? 'Posizione').toString();
    return Place(id: j['id']?.toString(), name: name, type: (j['type'] ?? 'stop').toString(), location: loc);
  }

  Map<String, dynamic> toJson() => {
        if (id != null) 'id': id,
        'name': name,
        'type': type,
        if (location != null) 'location': location!.toJson(),
      };

  /// Parametri della query journeys per questo luogo (prefisso "from" o "to").
  Map<String, String> asQuery(String prefix) {
    if (isStop && id != null) return {prefix: id!};
    return {
      '$prefix.latitude': '${location?.lat}',
      '$prefix.longitude': '${location?.lon}',
      '$prefix.address': name,
    };
  }
}

DateTime? _dt(dynamic v) => v is String ? DateTime.tryParse(v)?.toLocal() : null;
int? _int(dynamic v) => v is num ? v.toInt() : null;

class Stopover {
  final Place stop;
  final DateTime? arrival, plannedArrival, departure, plannedDeparture;
  final String? platform;
  final bool cancelled;
  const Stopover({required this.stop, this.arrival, this.plannedArrival, this.departure, this.plannedDeparture, this.platform, this.cancelled = false});

  /// Orario effettivo migliore disponibile (arrivo, altrimenti partenza).
  DateTime? get when => arrival ?? departure ?? plannedArrival ?? plannedDeparture;
  DateTime? get leaves => departure ?? plannedDeparture ?? arrival ?? plannedArrival;
  int get delayMinutes {
    final a = arrival ?? departure, p = plannedArrival ?? plannedDeparture;
    if (a == null || p == null) return 0;
    return a.difference(p).inMinutes;
  }

  factory Stopover.fromJson(Map<String, dynamic> j) => Stopover(
        stop: Place.fromJson(Map<String, dynamic>.from(j['stop'] as Map)),
        arrival: _dt(j['arrival']),
        plannedArrival: _dt(j['plannedArrival']),
        departure: _dt(j['departure']),
        plannedDeparture: _dt(j['plannedDeparture']),
        platform: (j['departurePlatform'] ?? j['arrivalPlatform'])?.toString(),
        cancelled: j['cancelled'] == true,
      );
}

class Line {
  final String name; // es. "Bus 42", "RE 5", "ICE 1234"
  final String product; // bus, regional, nationalExpress, suburban, subway, tram, ...
  const Line(this.name, this.product);
  factory Line.fromJson(Map<String, dynamic> j) => Line((j['name'] ?? j['fahrtNr'] ?? '').toString(), (j['product'] ?? j['mode'] ?? '').toString());

  /// Nome del mezzo in italiano.
  String get kind => switch (product) {
        'bus' => 'bus',
        'tram' => 'tram',
        'subway' => 'metro',
        'suburban' => 'S-Bahn',
        'ferry' => 'traghetto',
        'taxi' => 'taxi',
        _ => 'treno',
      };

  /// Come lo dice la guida: "il bus 42", "il treno RE 5", "la S-Bahn S 5", "la metro U 2".
  String get spoken {
    var n = name.trim();
    for (final p in ['Bus ', 'STR ', 'Tram ', 'Fähre ']) {
      if (n.toLowerCase().startsWith(p.toLowerCase())) n = n.substring(p.length).trim();
    }
    return switch (product) {
      'bus' => 'il bus $n',
      'tram' => 'il tram $n',
      'subway' => 'la metro $n',
      'suburban' => 'la S-Bahn $n',
      'ferry' => 'il traghetto $n',
      'taxi' => 'il taxi',
      _ => 'il treno $n',
    }.trim();
  }
}

class Leg {
  final Place origin, destination;
  final DateTime? departure, plannedDeparture, arrival, plannedArrival;
  final String? departurePlatform, arrivalPlatform, direction, tripId;
  final Line? line;
  final bool walking, cancelled;
  final int? distance; // metri, per i tratti a piedi
  final List<Stopover> stopovers;
  final List<LatLon> polyline;
  final List<String> remarks;

  const Leg({
    required this.origin,
    required this.destination,
    this.departure,
    this.plannedDeparture,
    this.arrival,
    this.plannedArrival,
    this.departurePlatform,
    this.arrivalPlatform,
    this.direction,
    this.tripId,
    this.line,
    this.walking = false,
    this.cancelled = false,
    this.distance,
    this.stopovers = const [],
    this.polyline = const [],
    this.remarks = const [],
  });

  DateTime? get dep => departure ?? plannedDeparture;
  DateTime? get arr => arrival ?? plannedArrival;
  int get departureDelay => (departure != null && plannedDeparture != null) ? departure!.difference(plannedDeparture!).inMinutes : 0;
  int get arrivalDelay => (arrival != null && plannedArrival != null) ? arrival!.difference(plannedArrival!).inMinutes : 0;

  /// Le fermate di questo tratto; se il server non le ha mandate, solo partenza e arrivo.
  List<Stopover> get stops => stopovers.isNotEmpty
      ? stopovers
      : [
          Stopover(stop: origin, departure: departure, plannedDeparture: plannedDeparture, platform: departurePlatform),
          Stopover(stop: destination, arrival: arrival, plannedArrival: plannedArrival, platform: arrivalPlatform),
        ];

  /// Punti da disegnare sulla mappa.
  List<LatLon> get path {
    if (polyline.length > 1) return polyline;
    return stops.map((s) => s.stop.location).whereType<LatLon>().toList();
  }

  factory Leg.fromJson(Map<String, dynamic> j) {
    final pts = <LatLon>[];
    final pl = j['polyline'];
    if (pl is Map && pl['features'] is List) {
      for (final f in pl['features'] as List) {
        final c = (f as Map)['geometry']?['coordinates'];
        if (c is List && c.length >= 2 && c[0] is num && c[1] is num) pts.add(LatLon((c[1] as num).toDouble(), (c[0] as num).toDouble()));
      }
    }
    return Leg(
      origin: Place.fromJson(Map<String, dynamic>.from(j['origin'] as Map)),
      destination: Place.fromJson(Map<String, dynamic>.from(j['destination'] as Map)),
      departure: _dt(j['departure']),
      plannedDeparture: _dt(j['plannedDeparture']),
      arrival: _dt(j['arrival']),
      plannedArrival: _dt(j['plannedArrival']),
      departurePlatform: j['departurePlatform']?.toString(),
      arrivalPlatform: j['arrivalPlatform']?.toString(),
      direction: j['direction']?.toString(),
      tripId: j['tripId']?.toString(),
      line: j['line'] is Map ? Line.fromJson(Map<String, dynamic>.from(j['line'] as Map)) : null,
      walking: j['walking'] == true,
      cancelled: j['cancelled'] == true,
      distance: _int(j['distance']),
      stopovers: (j['stopovers'] as List? ?? []).whereType<Map>().map((s) => Stopover.fromJson(Map<String, dynamic>.from(s))).toList(),
      polyline: pts,
      remarks: (j['remarks'] as List? ?? [])
          .whereType<Map>()
          .where((r) => r['type'] == 'warning' || r['type'] == 'status')
          .map((r) => (r['summary'] ?? r['text'] ?? '').toString())
          .where((t) => t.isNotEmpty)
          .toList(),
    );
  }
}

class Journey {
  final List<Leg> legs;
  final String? refreshToken;
  final Map<String, dynamic> raw; // salvato così com'è, per riaprirlo offline
  const Journey(this.legs, {this.refreshToken, this.raw = const {}});

  factory Journey.fromJson(Map<String, dynamic> j) => Journey(
        (j['legs'] as List).whereType<Map>().map((l) => Leg.fromJson(Map<String, dynamic>.from(l))).toList(),
        refreshToken: j['refreshToken']?.toString(),
        raw: j,
      );

  List<Leg> get rides => legs.where((l) => !l.walking).toList();
  DateTime? get departure => legs.isEmpty ? null : legs.first.dep;
  DateTime? get arrival => legs.isEmpty ? null : legs.last.arr;
  Duration get duration => (departure != null && arrival != null) ? arrival!.difference(departure!) : Duration.zero;
  int get changes => rides.isEmpty ? 0 : rides.length - 1;

  /// Minuti di cambio tra un mezzo e il successivo (null se non calcolabile).
  int? transferMinutes(int rideIndex) {
    final r = rides;
    if (rideIndex + 1 >= r.length) return null;
    final a = r[rideIndex].arr, d = r[rideIndex + 1].dep;
    if (a == null || d == null) return null;
    return d.difference(a).inMinutes;
  }
}

/// Partenza da una fermata (tabellone).
class Departure {
  final Line? line;
  final String? direction, platform, tripId;
  final DateTime? when, plannedWhen;
  final bool cancelled;
  const Departure({this.line, this.direction, this.platform, this.tripId, this.when, this.plannedWhen, this.cancelled = false});
  int get delayMinutes => (when != null && plannedWhen != null) ? when!.difference(plannedWhen!).inMinutes : 0;
  factory Departure.fromJson(Map<String, dynamic> j) => Departure(
        line: j['line'] is Map ? Line.fromJson(Map<String, dynamic>.from(j['line'] as Map)) : null,
        direction: j['direction']?.toString(),
        platform: (j['platform'] ?? j['plannedPlatform'])?.toString(),
        tripId: j['tripId']?.toString(),
        when: _dt(j['when']),
        plannedWhen: _dt(j['plannedWhen']),
        cancelled: j['cancelled'] == true,
      );
}
