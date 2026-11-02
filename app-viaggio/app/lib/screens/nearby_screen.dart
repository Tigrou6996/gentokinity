import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../models/transit.dart';
import '../services/transit_api.dart';
import '../theme.dart';

/// Fermate vicine e prossimi bus in partenza.
class NearbyScreen extends StatefulWidget {
  const NearbyScreen({super.key});
  @override
  State<NearbyScreen> createState() => _NearbyScreenState();
}

class _NearbyScreenState extends State<NearbyScreen> {
  final _api = TransitApi();
  List<Place> _stops = [];
  LatLon? _me;
  bool _loading = true;
  String? _err;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _err = null;
    });
    try {
      var p = await Geolocator.checkPermission();
      if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
      if (p == LocationPermission.denied || p == LocationPermission.deniedForever) throw Exception('Serve il permesso di posizione per trovare le fermate vicine.');
      final pos = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 15)));
      _me = LatLon(pos.latitude, pos.longitude);
      final s = await _api.nearbyStops(_me!);
      setState(() => _stops = s);
    } catch (e) {
      setState(() => _err = '$e'.replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _dist(Place p) {
    if (_me == null || p.location == null) return '';
    final m = Geolocator.distanceBetween(_me!.lat, _me!.lon, p.location!.lat, p.location!.lon);
    return m < 1000 ? '${m.round()} m' : '${(m / 1000).toStringAsFixed(1)} km';
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Fermate vicine')),
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            if (_loading) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
            if (_err != null) Card(color: const Color(0xFFFDECEC), child: Padding(padding: const EdgeInsets.all(14), child: Text(_err!, style: const TextStyle(color: kRed)))),
            ..._stops.map((s) => Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    leading: const CircleAvatar(backgroundColor: kLilac, child: Icon(Icons.directions_bus_rounded, color: kDark)),
                    title: Text(s.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text(_dist(s)),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: s.id == null ? null : () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => DeparturesScreen(stop: s))),
                  ),
                )),
          ]),
        ),
      );
}

class DeparturesScreen extends StatefulWidget {
  final Place stop;
  const DeparturesScreen({super.key, required this.stop});
  @override
  State<DeparturesScreen> createState() => _DeparturesScreenState();
}

class _DeparturesScreenState extends State<DeparturesScreen> {
  final _api = TransitApi();
  List<Departure> _deps = [];
  bool _loading = true;
  String? _err;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final d = await _api.departures(widget.stop.id!);
      setState(() {
        _deps = d;
        _err = null;
      });
    } catch (e) {
      setState(() => _err = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(widget.stop.name)),
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(padding: const EdgeInsets.all(12), children: [
            if (_loading && _deps.isEmpty) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
            if (_err != null) Text(_err!, style: const TextStyle(color: kRed)),
            if (!_loading && _deps.isEmpty && _err == null) const Padding(padding: EdgeInsets.all(24), child: Text('Nessuna partenza nella prossima ora.', textAlign: TextAlign.center)),
            ..._deps.map((d) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: LineChip(d.line),
                    title: Text(d.direction ?? '', style: TextStyle(fontWeight: FontWeight.w700, decoration: d.cancelled ? TextDecoration.lineThrough : null)),
                    subtitle: d.platform != null ? Text('${d.line?.product == 'bus' ? 'Fermata' : 'Binario'} ${d.platform}') : null,
                    trailing: d.cancelled ? const Text('cancellato', style: TextStyle(color: kRed, fontWeight: FontWeight.w700)) : TimeText(d.when, d.plannedWhen),
                  ),
                )),
          ]),
        ),
      );
}
