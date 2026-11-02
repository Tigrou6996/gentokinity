import 'package:flutter/material.dart';
import '../models/transit.dart';
import '../models/trip.dart';
import '../services/transit_api.dart';
import '../services/trip_store.dart';
import '../theme.dart';
import 'trip_screen.dart';

/// Elenco delle soluzioni: l'utente sceglie quella del suo biglietto.
class JourneyPickScreen extends StatefulWidget {
  final Place from, to;
  final DateTime departure;
  final TicketInfo ticket;
  const JourneyPickScreen({super.key, required this.from, required this.to, required this.departure, required this.ticket});
  @override
  State<JourneyPickScreen> createState() => _JourneyPickScreenState();
}

class _JourneyPickScreenState extends State<JourneyPickScreen> {
  final _api = TransitApi();
  final List<Journey> _list = [];
  bool _loading = true;
  String? _err;

  @override
  void initState() {
    super.initState();
    // qualche minuto prima, nel caso l'ora sul biglietto sia quella di arrivo in stazione
    _load(widget.departure.subtract(const Duration(minutes: 10)));
  }

  Future<void> _load(DateTime from, {bool more = false}) async {
    setState(() {
      _loading = true;
      _err = null;
    });
    try {
      final r = await _api.journeys(widget.from, widget.to, departure: from, results: 6);
      setState(() {
        if (!more) _list.clear();
        for (final j in r) {
          if (!_list.any((x) => x.departure == j.departure && x.arrival == j.arrival)) _list.add(j);
        }
      });
    } catch (e) {
      setState(() => _err = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _choose(Journey j) async {
    final t = SavedTrip(id: DateTime.now().microsecondsSinceEpoch.toString(), ticket: widget.ticket, journey: j, from: widget.from, to: widget.to, createdAt: DateTime.now());
    await TripStore.instance.upsert(t);
    if (!mounted) return;
    Navigator.of(context).popUntil((r) => r.isFirst);
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => TripScreen(tripId: t.id)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: lbsBar(title: const Text('Scegli il tuo viaggio')),
      body: RefreshIndicator(
        onRefresh: () => _load(widget.departure.subtract(const Duration(minutes: 10))),
        child: ListView(padding: const EdgeInsets.all(16), children: [
          Text('${widget.from.name} → ${widget.to.name}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text('${dayFmt.format(widget.departure)} · scegli la corsa indicata sul biglietto', style: const TextStyle(color: Colors.black54)),
          const SizedBox(height: 16),
          if (_err != null)
            Card(color: const Color(0xFFFDECEC), child: Padding(padding: const EdgeInsets.all(14), child: Text(_err!, style: const TextStyle(color: kRed)))),
          ..._list.map((j) => _JourneyCard(j, onTap: () => _choose(j))),
          if (_loading) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
          if (!_loading && _list.isEmpty && _err == null) const Padding(padding: EdgeInsets.all(24), child: Text('Nessuna soluzione trovata a quest\'ora. Prova a cambiare orario.', textAlign: TextAlign.center)),
          if (!_loading && _list.isNotEmpty)
            OutlinedButton.icon(
              onPressed: () => _load(_list.last.departure!.add(const Duration(minutes: 1)), more: true),
              icon: const Icon(Icons.expand_more_rounded),
              label: const Text('Corse più tardi'),
            ),
        ]),
      ),
    );
  }
}

class _JourneyCard extends StatelessWidget {
  final Journey j;
  final VoidCallback onTap;
  const _JourneyCard(this.j, {required this.onTap});
  @override
  Widget build(BuildContext context) {
    final first = j.legs.first, last = j.legs.last;
    final cancelled = j.legs.any((l) => l.cancelled);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              TimeText(first.departure, first.plannedDeparture, size: 20),
              const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Icon(Icons.arrow_forward_rounded, size: 18, color: Colors.black38)),
              TimeText(last.arrival, last.plannedArrival, size: 20),
              const Spacer(),
              Text(fmtDur(j.duration), style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.black54)),
            ]),
            const SizedBox(height: 10),
            Wrap(spacing: 6, runSpacing: 6, children: [
              ...j.rides.map((l) => LineChip(l.line)),
              Chip(visualDensity: VisualDensity.compact, label: Text(j.changes == 0 ? 'Diretto' : '${j.changes} cambi${j.changes == 1 ? 'o' : ''}')),
              if (cancelled) const Chip(visualDensity: VisualDensity.compact, backgroundColor: Color(0xFFFDECEC), label: Text('Cancellato', style: TextStyle(color: kRed))),
            ]),
          ]),
        ),
      ),
    );
  }
}
