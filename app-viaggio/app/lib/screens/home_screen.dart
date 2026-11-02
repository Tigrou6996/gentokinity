import 'package:flutter/material.dart';
import '../models/trip.dart';
import '../services/guide_service.dart';
import '../services/trip_store.dart';
import '../theme.dart';
import 'add_ticket_screen.dart';
import 'nearby_screen.dart';
import 'settings_screen.dart';
import 'trip_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = TripStore.instance;
    return Scaffold(
      appBar: AppBar(
        title: const Text('LBS Viaggio', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(tooltip: 'Fermate vicine', icon: const Icon(Icons.near_me_rounded), onPressed: () => _go(context, const NearbyScreen())),
          IconButton(tooltip: 'Impostazioni', icon: const Icon(Icons.settings_rounded), onPressed: () => _go(context, const SettingsScreen())),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _go(context, const AddTicketScreen()),
        icon: const Icon(Icons.confirmation_number_rounded),
        label: const Text('Aggiungi biglietto', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: ListenableBuilder(
        listenable: Listenable.merge([store, GuideService.instance]),
        builder: (context, _) {
          if (store.trips.isEmpty) return _Empty(onAdd: () => _go(context, const AddTicketScreen()));
          final now = DateTime.now();
          final next = store.trips.where((t) => (t.journey.arrival ?? t.createdAt).isAfter(now.subtract(const Duration(hours: 2)))).toList();
          final past = store.trips.where((t) => !next.contains(t)).toList().reversed.toList();
          return ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 100), children: [
            if (next.isNotEmpty) const _Header('I tuoi viaggi'),
            ...next.map((t) => _TripCard(t)),
            if (past.isNotEmpty) const _Header('Viaggi passati'),
            ...past.map((t) => _TripCard(t, faded: true)),
          ]);
        },
      ),
    );
  }

  static void _go(BuildContext c, Widget w) => Navigator.of(c).push(MaterialPageRoute(builder: (_) => w));
}

class _Header extends StatelessWidget {
  final String t;
  const _Header(this.t);
  @override
  Widget build(BuildContext context) =>
      Padding(padding: const EdgeInsets.fromLTRB(4, 8, 4, 10), child: Text(t.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1.4, fontSize: 12, color: Colors.black54)));
}

class _TripCard extends StatelessWidget {
  final SavedTrip trip;
  final bool faded;
  const _TripCard(this.trip, {this.faded = false});
  @override
  Widget build(BuildContext context) {
    final j = trip.journey, guiding = GuideService.instance.tripId == trip.id;
    return Opacity(
      opacity: faded ? .6 : 1,
      child: Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => TripScreen(tripId: trip.id))),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text(j.departure == null ? '' : dayFmt.format(j.departure!), style: const TextStyle(color: kPurple, fontWeight: FontWeight.w700)),
                const Spacer(),
                if (guiding) const Chip(avatar: Icon(Icons.record_voice_over_rounded, size: 16, color: Colors.white), label: Text('Guida attiva'), backgroundColor: kGreen, labelStyle: TextStyle(color: Colors.white)),
                if (trip.ticket.filePath != null || trip.ticket.code != null) const Icon(Icons.confirmation_number_outlined, color: kPurple),
              ]),
              const SizedBox(height: 8),
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(fmtTime(j.departure), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                  Text(fmtTime(j.arrival), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.black54)),
                ]),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(trip.from.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 6),
                    Text(trip.to.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: Colors.black54), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ]),
                ),
              ]),
              const SizedBox(height: 10),
              Wrap(spacing: 6, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                ...j.rides.map((l) => LineChip(l.line)),
                Text('  ${fmtDur(j.duration)} · ${j.changes == 0 ? 'diretto' : '${j.changes} cambi${j.changes == 1 ? 'o' : ''}'}', style: const TextStyle(color: Colors.black54)),
              ]),
            ]),
          ),
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  final VoidCallback onAdd;
  const _Empty({required this.onAdd});
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 120,
              height: 120,
              decoration: const BoxDecoration(color: kLilac, shape: BoxShape.circle),
              child: const Icon(Icons.directions_bus_rounded, size: 64, color: kDark),
            ),
            const SizedBox(height: 24),
            const Text('Il tuo viaggio, passo dopo passo', textAlign: TextAlign.center, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            const Text(
              'Aggiungi il biglietto: l\'app trova il percorso, le coincidenze e le fermate, e una voce ti avvisa quando scendere.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, color: Colors.black54),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(onPressed: onAdd, icon: const Icon(Icons.add_rounded), label: const Text('Aggiungi il tuo biglietto')),
          ]),
        ),
      );
}
