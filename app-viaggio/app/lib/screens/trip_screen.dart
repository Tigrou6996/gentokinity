import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:pdfx/pdfx.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import '../models/transit.dart';
import '../config.dart';
import '../models/trip.dart';
import '../services/demo.dart';
import '../services/guide_engine.dart';
import '../services/guide_service.dart';
import '../services/transit_api.dart';
import '../services/trip_store.dart';
import '../theme.dart';

class TripScreen extends StatefulWidget {
  final String tripId;
  const TripScreen({super.key, required this.tripId});
  @override
  State<TripScreen> createState() => _TripScreenState();
}

class _TripScreenState extends State<TripScreen> {
  final _api = TransitApi();
  bool _refreshing = false;

  SavedTrip? get _trip => TripStore.instance.trips.where((t) => t.id == widget.tripId).firstOrNull;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_trip != null && !Demo.isDemo(_trip!)) _refresh(silent: true);
    });
  }

  Future<void> _refresh({bool silent = false}) async {
    final t = _trip;
    if (t == null || _refreshing) return;
    if ((t.journey.arrival ?? DateTime.now()).isBefore(DateTime.now().subtract(const Duration(hours: 1)))) return;
    setState(() => _refreshing = true);
    try {
      final j = await _api.refresh(t.journey);
      if (j != null) {
        t.journey = j;
        await TripStore.instance.upsert(t);
        if (GuideService.instance.tripId == t.id) GuideService.instance.replaceJourney(j);
        if (!silent && mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Orari aggiornati')));
      }
    } catch (e) {
      if (!silent && mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  Future<void> _toggleGuide(SavedTrip t, bool on) async {
    if (!on) {
      await GuideService.instance.stop();
      await WakelockPlus.disable();
      return;
    }
    // nel viaggio di esempio il tempo scorre 12 volte più veloce, così si sentono tutti gli annunci in pochi minuti
    final warn = await GuideService.instance.start(t.id, t.journey, speed: Demo.isDemo(t) ? 12 : 1);
    await WakelockPlus.enable();
    if (warn != null && mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(warn)));
  }

  Future<void> _delete(SavedTrip t) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Eliminare il viaggio?'),
        content: const Text('Verranno cancellati anche il biglietto salvato e i dati del percorso.'),
        actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Annulla')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Elimina'))],
      ),
    );
    if (ok != true) return;
    if (GuideService.instance.tripId == t.id) await GuideService.instance.stop();
    await TripStore.instance.remove(t);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([TripStore.instance, GuideService.instance]),
      builder: (context, _) {
        final t = _trip;
        if (t == null) return const Scaffold(body: Center(child: Text('Viaggio non trovato')));
        final g = GuideService.instance, guiding = g.tripId == t.id;
        return DefaultTabController(
          length: 4,
          child: Scaffold(
            appBar: lbsBar(
              title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800), overflow: TextOverflow.ellipsis),
                if (t.journey.departure != null)
                  Text('${dayFmt.format(t.journey.departure!)} · ${fmtTime(t.journey.departure)}–${fmtTime(t.journey.arrival)}', style: const TextStyle(fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.w600, color: kLilac)),
              ]),
              actions: [
                IconButton(
                  tooltip: 'Aggiorna ritardi',
                  onPressed: _refreshing ? null : () => _refresh(),
                  icon: _refreshing ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.refresh_rounded),
                ),
                IconButton(tooltip: 'Elimina', onPressed: () => _delete(t), icon: const Icon(Icons.delete_outline_rounded)),
              ],
              bottom: const TabBar(
                // tutte e quattro le schede sempre visibili, anche sui telefoni piccoli
                padding: EdgeInsets.fromLTRB(10, 0, 10, 10),
                labelPadding: EdgeInsets.symmetric(horizontal: 2),
                splashBorderRadius: BorderRadius.all(Radius.circular(999)),
                tabs: [Tab(text: 'Mappa'), Tab(text: 'Coincidenze'), Tab(text: 'Fermate'), Tab(text: 'Biglietto')],
              ),
            ),
            body: Column(children: [
              Expanded(
                child: TabBarView(physics: const NeverScrollableScrollPhysics(), children: [
                  AppConfig.mapsEnabled ? _MapTab(t.journey) : _RouteSketch(t.journey),
                  _ConnectionsTab(t.journey),
                  _StopsTab(t.journey, guiding ? g.status : null),
                  _TicketTab(t.ticket),
                ]),
              ),
              _GuidePanel(on: guiding, status: guiding ? g.status : null, onChanged: (v) => _toggleGuide(t, v)),
            ]),
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------- guida vocale
class _GuidePanel extends StatelessWidget {
  final bool on;
  final GuideStatus? status;
  final ValueChanged<bool> onChanged;
  const _GuidePanel({required this.on, required this.status, required this.onChanged});
  @override
  Widget build(BuildContext context) {
    final s = status;
    return Material(
      color: on ? kDark : Colors.white,
      elevation: 8,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 12, 12, 12),
          child: Row(children: [
            Icon(on ? Icons.record_voice_over_rounded : Icons.voice_over_off_rounded, color: on ? kLilac : kPurple, size: 30),
            const SizedBox(width: 14),
            Expanded(
              child: on && s != null
                  ? Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Text(s.headline.toUpperCase(), style: const TextStyle(color: kLilac, fontWeight: FontWeight.w800, fontSize: 12, letterSpacing: 1.2)),
                      Text(s.stopName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 20), maxLines: 1, overflow: TextOverflow.ellipsis),
                      if (s.at != null) Text('alle ${fmtTime(s.at)}', style: const TextStyle(color: Colors.white70)),
                    ])
                  : const Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Text('Guida vocale', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
                      Text('Una voce ti dice la prossima fermata e quando scendere', style: TextStyle(color: Colors.black54, fontSize: 13)),
                    ]),
            ),
            Switch(value: on, onChanged: onChanged, activeThumbColor: kGreen),
          ]),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------- mappa
class _MapTab extends StatefulWidget {
  final Journey j;
  const _MapTab(this.j);
  @override
  State<_MapTab> createState() => _MapTabState();
}

class _MapTabState extends State<_MapTab> with AutomaticKeepAliveClientMixin {
  GoogleMapController? _ctl;
  @override
  bool get wantKeepAlive => true;

  LatLng _ll(LatLon p) => LatLng(p.lat, p.lon);

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final lines = <Polyline>{}, markers = <Marker>{};
    final all = <LatLng>[];
    for (var i = 0; i < widget.j.legs.length; i++) {
      final l = widget.j.legs[i], pts = l.path.map(_ll).toList();
      if (pts.length < 2) continue;
      all.addAll(pts);
      lines.add(Polyline(
        polylineId: PolylineId('leg$i'),
        points: pts,
        width: l.walking ? 5 : 7,
        color: l.walking ? Colors.black45 : lineColor(l.line),
        patterns: l.walking ? [PatternItem.dot, PatternItem.gap(12)] : const [],
        jointType: JointType.round,
        startCap: Cap.roundCap,
        endCap: Cap.roundCap,
      ));
      if (!l.walking) {
        for (final s in l.stops) {
          final p = s.stop.location;
          if (p == null) continue;
          markers.add(Marker(
            markerId: MarkerId('s$i-${s.stop.id ?? s.stop.name}'),
            position: _ll(p),
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueViolet),
            alpha: s == l.stops.first || s == l.stops.last ? 1 : .55,
            infoWindow: InfoWindow(title: s.stop.name, snippet: fmtTime(s.when)),
          ));
        }
      }
    }
    final first = widget.j.legs.isNotEmpty ? widget.j.legs.first.origin.location : null;
    final last = widget.j.legs.isNotEmpty ? widget.j.legs.last.destination.location : null;
    if (first != null) markers.add(Marker(markerId: const MarkerId('start'), position: _ll(first), icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen), infoWindow: const InfoWindow(title: 'Partenza')));
    if (last != null) markers.add(Marker(markerId: const MarkerId('end'), position: _ll(last), icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed), infoWindow: const InfoWindow(title: 'Arrivo')));

    final center = all.isNotEmpty ? all.first : const LatLng(51.16, 10.45);
    return Stack(children: [
      GoogleMap(
        initialCameraPosition: CameraPosition(target: center, zoom: 12),
        polylines: lines,
        markers: markers,
        myLocationEnabled: true,
        myLocationButtonEnabled: true,
        mapToolbarEnabled: false,
        onMapCreated: (c) {
          _ctl = c;
          Future.delayed(const Duration(milliseconds: 300), _fit(all));
        },
      ),
      Positioned(
        left: 12,
        top: 12,
        child: FloatingActionButton.small(heroTag: 'fit', backgroundColor: Colors.white, onPressed: _fit(all), child: const Icon(Icons.route_rounded, color: kPurple)),
      ),
    ]);
  }

  VoidCallback _fit(List<LatLng> pts) => () {
        if (_ctl == null || pts.length < 2) return;
        var s = pts.first.latitude, n = s, w = pts.first.longitude, e = w;
        for (final p in pts) {
          if (p.latitude < s) s = p.latitude;
          if (p.latitude > n) n = p.latitude;
          if (p.longitude < w) w = p.longitude;
          if (p.longitude > e) e = p.longitude;
        }
        _ctl!.animateCamera(CameraUpdate.newLatLngBounds(LatLngBounds(southwest: LatLng(s, w), northeast: LatLng(n, e)), 60));
      };
}

// ---------------------------------------------------------------- schema del percorso (senza chiave Google Maps)
class _RouteSketch extends StatelessWidget {
  final Journey j;
  const _RouteSketch(this.j);
  @override
  Widget build(BuildContext context) => Column(children: [
        Container(
          width: double.infinity,
          color: const Color(0xFFFFF4D6),
          padding: const EdgeInsets.all(12),
          child: const Text('Anteprima: la mappa Google si attiva con la chiave Google Maps. Qui vedi lo schema del percorso.', style: TextStyle(fontSize: 13)),
        ),
        Expanded(child: Padding(padding: const EdgeInsets.all(20), child: CustomPaint(painter: _SketchPainter(j), size: Size.infinite))),
      ]);
}

class _SketchPainter extends CustomPainter {
  final Journey j;
  _SketchPainter(this.j);
  @override
  void paint(Canvas c, Size size) {
    final pts = j.legs.expand((l) => l.path).toList();
    if (pts.length < 2) return;
    var minLat = pts.first.lat, maxLat = minLat, minLon = pts.first.lon, maxLon = minLon;
    for (final p in pts) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lon < minLon) minLon = p.lon;
      if (p.lon > maxLon) maxLon = p.lon;
    }
    // margini larghi ai lati per i nomi delle fermate
    const mx = 110.0, my = 30.0;
    final kx = .63, w = (maxLon - minLon) * kx, h = maxLat - minLat;
    final aw = size.width - 2 * mx, ah = size.height - 2 * my;
    final sc = (w == 0 || h == 0) ? 1.0 : (aw / w < ah / h ? aw / w : ah / h);
    Offset o(LatLon p) => Offset(mx + ((p.lon - minLon) * kx) * sc + (aw - w * sc) / 2, my + (maxLat - p.lat) * sc + (ah - h * sc) / 2);
    final placed = <Rect>[];
    for (final l in j.legs) {
      final path = l.path;
      if (path.length < 2) continue;
      final pa = Path()..moveTo(o(path.first).dx, o(path.first).dy);
      for (final p in path.skip(1)) {
        pa.lineTo(o(p).dx, o(p).dy);
      }
      c.drawPath(pa, Paint()..color = l.walking ? Colors.black38 : lineColor(l.line)..style = PaintingStyle.stroke..strokeWidth = l.walking ? 3 : 6..strokeCap = StrokeCap.round..strokeJoin = StrokeJoin.round);
      if (l.walking) continue;
      for (final s in l.stops) {
        final p = s.stop.location;
        if (p == null) continue;
        final e = s == l.stops.first || s == l.stops.last;
        c.drawCircle(o(p), e ? 9 : 6, Paint()..color = Colors.white);
        c.drawCircle(o(p), e ? 9 : 6, Paint()..color = lineColor(l.line)..style = PaintingStyle.stroke..strokeWidth = 3);
        final tp = TextPainter(text: TextSpan(text: s.stop.name, style: TextStyle(color: kDark, fontSize: e ? 13 : 11, fontWeight: e ? FontWeight.w800 : FontWeight.w500)), textDirection: TextDirection.ltr)..layout(maxWidth: mx - 14);
        // a destra del punto, o a sinistra se non c'è spazio; salta i nomi che si sovrapporrebbero
        final right = o(p).dx + 12 + tp.width < size.width;
        var at = o(p) + Offset(right ? 12 : -12 - tp.width, -tp.height / 2);
        var r = at & tp.size;
        if (placed.any((q) => q.overlaps(r))) {
          at = at + Offset(0, tp.height + 2);
          r = at & tp.size;
          if (placed.any((q) => q.overlaps(r))) continue;
        }
        placed.add(r);
        tp.paint(c, at);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _SketchPainter old) => old.j != j;
}

// ---------------------------------------------------------------- coincidenze
class _ConnectionsTab extends StatelessWidget {
  final Journey j;
  const _ConnectionsTab(this.j);
  @override
  Widget build(BuildContext context) {
    final items = <Widget>[];
    var ride = 0;
    for (var i = 0; i < j.legs.length; i++) {
      final l = j.legs[i];
      if (l.walking) {
        final mins = (l.arr != null && l.dep != null) ? l.arr!.difference(l.dep!).inMinutes : null;
        items.add(ListTile(
          leading: const CircleAvatar(backgroundColor: Color(0xFFEDE7F0), child: Icon(Icons.directions_walk_rounded, color: kPurple)),
          title: Text('A piedi${mins != null ? ' · $mins min' : ''}${l.distance != null ? ' · ${l.distance} m' : ''}'),
          subtitle: Text('fino a ${l.destination.name}'),
        ));
        continue;
      }
      items.add(_RideCard(l));
      final tm = j.transferMinutes(ride);
      if (tm != null) {
        final c = tm < 0 ? kRed : (tm < 5 ? kOrange : kGreen);
        items.add(Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
          child: Row(children: [
            Icon(Icons.sync_alt_rounded, color: c),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                tm < 0 ? 'Coincidenza persa: cerca un\'alternativa' : 'Cambio a ${l.destination.name}: $tm min${tm < 5 ? ' (stretto, affrettati!)' : ''}',
                style: TextStyle(color: c, fontWeight: FontWeight.w700),
              ),
            ),
          ]),
        ));
      }
      ride++;
    }
    return ListView(padding: const EdgeInsets.all(16), children: items);
  }
}

class _RideCard extends StatelessWidget {
  final Leg l;
  const _RideCard(this.l);
  @override
  Widget build(BuildContext context) {
    final pl = l.line?.product == 'bus' ? 'Fermata' : 'Binario';
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            LineChip(l.line, big: true),
            const SizedBox(width: 10),
            Expanded(child: Text(l.direction != null ? 'direzione ${l.direction}' : '', style: const TextStyle(color: Colors.black54, fontWeight: FontWeight.w600), maxLines: 2)),
          ]),
          if (l.cancelled) const Padding(padding: EdgeInsets.only(top: 8), child: Text('CORSA CANCELLATA', style: TextStyle(color: kRed, fontWeight: FontWeight.w800))),
          const SizedBox(height: 12),
          _row(TimeText(l.departure, l.plannedDeparture), l.origin.name, l.departurePlatform != null ? '$pl ${l.departurePlatform}' : null),
          Padding(
            padding: const EdgeInsets.only(left: 22, top: 2, bottom: 2),
            child: Text('${l.stops.length - 2 < 0 ? 0 : l.stops.length - 2} fermate intermedie', style: const TextStyle(color: Colors.black45, fontSize: 13)),
          ),
          _row(TimeText(l.arrival, l.plannedArrival), l.destination.name, l.arrivalPlatform != null ? '$pl ${l.arrivalPlatform}' : null),
          ...l.remarks.take(3).map((r) => Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Icon(Icons.warning_amber_rounded, size: 18, color: kOrange), const SizedBox(width: 6), Expanded(child: Text(r, style: const TextStyle(fontSize: 13)))]),
              )),
        ]),
      ),
    );
  }

  Widget _row(Widget time, String name, String? platform) => Row(children: [
        SizedBox(width: 84, child: time),
        Expanded(child: Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16))),
        if (platform != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: const Color(0xFFF1E6FA), borderRadius: BorderRadius.circular(6)),
            child: Text(platform, style: const TextStyle(fontWeight: FontWeight.w700, color: kPurple, fontSize: 13)),
          ),
      ]);
}

// ---------------------------------------------------------------- fermate
class _StopsTab extends StatefulWidget {
  final Journey j;
  final GuideStatus? status;
  const _StopsTab(this.j, this.status);
  @override
  State<_StopsTab> createState() => _StopsTabState();
}

class _StopsTabState extends State<_StopsTab> {
  int? _sel;

  @override
  Widget build(BuildContext context) {
    final rides = widget.j.rides;
    if (rides.isEmpty) return const Center(child: Text('Questo viaggio è tutto a piedi.'));
    final now = DateTime.now();
    final auto = widget.status != null && widget.status!.ride >= 0 && widget.status!.ride < rides.length
        ? widget.status!.ride
        : rides.indexWhere((l) => (l.arr ?? now).isAfter(now)).clamp(0, rides.length - 1);
    final sel = _sel ?? auto;
    final leg = rides[sel], stops = leg.stops;
    // prossima fermata: dalla guida se attiva, altrimenti dagli orari
    final next = (widget.status != null && widget.status!.ride == sel) ? widget.status!.nextStop : stops.indexWhere((s) => (s.when ?? now).isAfter(now));
    return Column(children: [
      if (rides.length > 1)
        SizedBox(
          height: 56,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), children: [
            for (var i = 0; i < rides.length; i++)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(label: Text(rides[i].line?.name ?? 'Tratto ${i + 1}'), selected: i == sel, onSelected: (_) => setState(() => _sel = i)),
              ),
          ]),
        ),
      Expanded(
        child: ListView.builder(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
          itemCount: stops.length,
          itemBuilder: (_, i) {
            final s = stops[i], passed = next >= 0 && i < next, isNext = i == next;
            final edge = i == 0 || i == stops.length - 1;
            return IntrinsicHeight(
              child: Row(children: [
                SizedBox(width: 70, child: Padding(padding: const EdgeInsets.symmetric(vertical: 14), child: TimeText(s.when, s.plannedArrival ?? s.plannedDeparture, size: 15))),
                SizedBox(
                  width: 30,
                  child: Stack(alignment: Alignment.center, children: [
                    Positioned.fill(
                      child: Column(children: [
                        Expanded(child: Container(width: 4, color: i == 0 ? Colors.transparent : (passed || isNext ? kLilac : lineColor(leg.line)))),
                        Expanded(child: Container(width: 4, color: i == stops.length - 1 ? Colors.transparent : (passed ? kLilac : lineColor(leg.line)))),
                      ]),
                    ),
                    Container(
                      width: isNext ? 22 : (edge ? 18 : 12),
                      height: isNext ? 22 : (edge ? 18 : 12),
                      decoration: BoxDecoration(
                        color: isNext ? kGreen : Colors.white,
                        shape: BoxShape.circle,
                        border: Border.all(color: passed ? kLilac : lineColor(leg.line), width: 3),
                      ),
                    ),
                  ]),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text(s.stop.name,
                          style: TextStyle(
                              fontSize: edge || isNext ? 17 : 15,
                              fontWeight: edge || isNext ? FontWeight.w800 : FontWeight.w500,
                              color: passed ? Colors.black38 : kDark,
                              decoration: s.cancelled ? TextDecoration.lineThrough : null)),
                      if (isNext) const Text('Prossima fermata', style: TextStyle(color: kGreen, fontWeight: FontWeight.w700, fontSize: 13)),
                      if (i == stops.length - 1) const Text('Scendi qui', style: TextStyle(color: kPurple, fontWeight: FontWeight.w700, fontSize: 13)),
                    ]),
                  ),
                ),
                if (s.platform != null) Text(s.platform!, style: const TextStyle(color: Colors.black45, fontWeight: FontWeight.w600)),
              ]),
            );
          },
        ),
      ),
    ]);
  }
}

// ---------------------------------------------------------------- biglietto
class _TicketTab extends StatelessWidget {
  final TicketInfo t;
  const _TicketTab(this.t);
  @override
  Widget build(BuildContext context) {
    final f = t.filePath;
    if (!kIsWeb && f != null && File(f).existsSync()) {
      if (t.fileType == 'pdf') return PdfViewPinch(controller: PdfControllerPinch(document: PdfDocument.openFile(f)));
      return InteractiveViewer(maxScale: 6, child: Center(child: Image.file(File(f))));
    }
    return ListView(padding: const EdgeInsets.all(24), children: [
      const Icon(Icons.confirmation_number_outlined, size: 64, color: kPurple),
      const SizedBox(height: 12),
      Text(t.operator ?? 'Biglietto', textAlign: TextAlign.center, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      if (t.code != null) ...[
        const SizedBox(height: 16),
        const Text('Codice del biglietto', textAlign: TextAlign.center, style: TextStyle(color: Colors.black54)),
        SelectableText(t.code!, textAlign: TextAlign.center, style: const TextStyle(fontFamily: 'monospace')),
      ],
      if (t.code == null) const Text('Nessun file del biglietto salvato per questo viaggio.', textAlign: TextAlign.center, style: TextStyle(color: Colors.black54)),
    ]);
  }
}
