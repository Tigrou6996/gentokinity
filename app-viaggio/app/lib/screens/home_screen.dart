import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/trip.dart';
import '../services/demo.dart';
import '../services/guide_service.dart';
import '../services/trip_store.dart';
import '../theme.dart';
import 'add_ticket_screen.dart';
import 'nearby_screen.dart';
import 'settings_screen.dart';
import 'trip_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  static void _go(BuildContext c, Widget w) => Navigator.of(c).push(MaterialPageRoute(builder: (_) => w));

  static Future<void> _demo(BuildContext c) async {
    final t = Demo.trip();
    await TripStore.instance.upsert(t);
    if (c.mounted) _go(c, TripScreen(tripId: t.id));
  }

  @override
  Widget build(BuildContext context) {
    final store = TripStore.instance;
    return Scaffold(
      body: ListenableBuilder(
        listenable: Listenable.merge([store, GuideService.instance]),
        builder: (context, _) {
          final now = DateTime.now();
          final next = store.trips.where((t) => (t.journey.arrival ?? t.createdAt).isAfter(now.subtract(const Duration(hours: 2)))).toList();
          final past = store.trips.where((t) => !next.contains(t)).toList().reversed.toList();
          return CustomScrollView(slivers: [
            SliverToBoxAdapter(
              child: _Hero(
                onSettings: () => _go(context, const SettingsScreen()),
                actions: Row(children: [
                  Expanded(flex: 5, child: _Action(Icons.confirmation_number_rounded, 'Aggiungi\nbiglietto', primary: true, onTap: () => _go(context, const AddTicketScreen()))),
                  const SizedBox(width: 10),
                  Expanded(flex: 4, child: _Action(Icons.near_me_rounded, 'Fermate\nvicine', onTap: () => _go(context, const NearbyScreen()))),
                  const SizedBox(width: 10),
                  Expanded(flex: 4, child: _Action(Icons.play_circle_rounded, 'Viaggio di\nesempio', onTap: () => _demo(context))),
                ]),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              sliver: SliverList.list(children: [
                if (store.trips.isEmpty) _Empty(onAdd: () => _go(context, const AddTicketScreen()), onDemo: () => _demo(context)),
                if (next.isNotEmpty) const SectionLabel('I tuoi viaggi'),
                ...next.map((t) => _TripCard(t)),
                if (past.isNotEmpty) const SectionLabel('Viaggi passati'),
                ...past.map((t) => _TripCard(t, faded: true)),
                const SectionLabel('Assistenza'),
                const SupportCard(),
              ]),
            ),
          ]);
        },
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  final VoidCallback onSettings;
  final Widget actions;
  const _Hero({required this.onSettings, required this.actions});
  @override
  Widget build(BuildContext context) => Stack(children: [
        // il viola finisce a metà dei pulsanti, che "galleggiano" sul bordo
        const Positioned(left: 0, right: 0, top: 0, bottom: 46, child: BrandPattern(radius: BorderRadius.vertical(bottom: Radius.circular(32)))),
        SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 8, 0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const LbsLogo(size: 46),
                const SizedBox(width: 12),
                const Expanded(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('LBS Viaggio', style: TextStyle(fontFamily: 'PlusJakartaSans', fontWeight: FontWeight.w800, fontSize: 20, color: Colors.white)),
                      Text('LAVORO · BUSINESS · SERVIZI', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 10, letterSpacing: 1.6, color: kLilac)),
                    ]),
                  ),
                ),
                IconButton(tooltip: 'Impostazioni', onPressed: onSettings, icon: const Icon(Icons.settings_rounded, color: Colors.white)),
              ]),
              const SizedBox(height: 26),
              const Text('Il tuo viaggio\nverso il lavoro', style: TextStyle(fontFamily: 'PlusJakartaSans', fontWeight: FontWeight.w800, fontSize: 30, height: 1.1, color: Colors.white, letterSpacing: -.5)),
              const SizedBox(height: 10),
              const Padding(
                padding: EdgeInsets.only(right: 12),
                child: Text('Percorso, coincidenze e una voce che ti avvisa quando scendere.', style: TextStyle(fontSize: 15, color: Color(0xFFEBD9FB))),
              ),
              const SizedBox(height: 26),
              Padding(padding: const EdgeInsets.only(right: 12), child: actions),
            ]),
          ),
        ),
      ]);
}

class _Action extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool primary;
  final VoidCallback onTap;
  const _Action(this.icon, this.label, {required this.onTap, this.primary = false});
  @override
  Widget build(BuildContext context) => Material(
        color: primary ? kLilac : Colors.white,
        borderRadius: BorderRadius.circular(22),
        elevation: 6,
        shadowColor: const Color(0x3330103D),
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 14, 8, 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              IconBubble(icon, size: 40, bg: primary ? kPurple : const Color(0xFFF1E6FA), fg: primary ? Colors.white : kPurple),
              const SizedBox(height: 10),
              Text(label, style: const TextStyle(fontFamily: 'PlusJakartaSans', fontWeight: FontWeight.w800, fontSize: 14, height: 1.15, color: kInk)),
            ]),
          ),
        ),
      );
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
      child: Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Card(
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => TripScreen(tripId: trip.id))),
            child: IntrinsicHeight(
              child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Container(width: 6, color: guiding ? kGreen : kPurple),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Text(j.departure == null ? '' : dayFmt.format(j.departure!).toUpperCase(), style: const TextStyle(color: kPurple, fontWeight: FontWeight.w800, fontSize: 12, letterSpacing: 1.2)),
                        const Spacer(),
                        if (Demo.isDemo(trip)) const _Tag('Esempio', Color(0xFFF1E6FA), kPurple),
                        if (guiding) const _Tag('Guida attiva', kGreen, Colors.white),
                      ]),
                      const SizedBox(height: 10),
                      _Stop(fmtTime(j.departure), trip.from.name, first: true),
                      _Stop(fmtTime(j.arrival), trip.to.name),
                      const SizedBox(height: 12),
                      Wrap(spacing: 6, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                        ...j.rides.map((l) => LineChip(l.line)),
                        Text('  ${fmtDur(j.duration)} · ${j.changes == 0 ? 'diretto' : '${j.changes} cambi${j.changes == 1 ? 'o' : ''}'}', style: const TextStyle(color: kMuted, fontWeight: FontWeight.w600)),
                      ]),
                    ]),
                  ),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

class _Stop extends StatelessWidget {
  final String time, name;
  final bool first;
  const _Stop(this.time, this.name, {this.first = false});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          SizedBox(width: 58, child: Text(time, style: TextStyle(fontFamily: 'PlusJakartaSans', fontWeight: FontWeight.w800, fontSize: 19, color: first ? kInk : kMuted))),
          Icon(first ? Icons.radio_button_checked_rounded : Icons.location_on_rounded, size: 18, color: first ? kPurple : kMuted),
          const SizedBox(width: 8),
          Expanded(child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: first ? kInk : kMuted))),
        ]),
      );
}

class _Tag extends StatelessWidget {
  final String t;
  final Color bg, fg;
  const _Tag(this.t, this.bg, this.fg);
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(left: 6),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
        child: Text(t, style: TextStyle(color: fg, fontWeight: FontWeight.w800, fontSize: 11)),
      );
}

class _Empty extends StatelessWidget {
  final VoidCallback onAdd, onDemo;
  const _Empty({required this.onAdd, required this.onDemo});
  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
          child: Column(children: [
            const IconBubble(Icons.directions_bus_rounded, size: 84),
            const SizedBox(height: 16),
            const Text('Nessun viaggio, per ora', textAlign: TextAlign.center, style: TextStyle(fontFamily: 'PlusJakartaSans', fontSize: 21, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Text(
              'Aggiungi il biglietto: l\'app trova il percorso, le coincidenze e le fermate, e una voce ti avvisa quando scendere.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 15, color: kMuted, height: 1.35),
            ),
            const SizedBox(height: 18),
            SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: onAdd, icon: const Icon(Icons.add_rounded), label: const Text('Aggiungi il tuo biglietto'))),
            const SizedBox(height: 4),
            TextButton.icon(onPressed: onDemo, icon: const Icon(Icons.play_circle_outline_rounded), label: const Text('Prova con un viaggio di esempio')),
          ]),
        ),
      );
}

/// Contatti LBS: WhatsApp Germania e Italia, email.
class SupportCard extends StatelessWidget {
  const SupportCard({super.key});

  static Future<void> _open(String url) => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: Stack(children: [
          const Positioned.fill(child: BrandPattern()),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Row(children: [
                Icon(Icons.support_agent_rounded, color: kLilac, size: 30),
                SizedBox(width: 10),
                Expanded(child: Text('Assistenza LBS 24/7', style: TextStyle(fontFamily: 'PlusJakartaSans', fontWeight: FontWeight.w800, fontSize: 19, color: Colors.white))),
              ]),
              const SizedBox(height: 6),
              const Text('Un problema durante il viaggio? Scrivici, ti rispondiamo in italiano.', style: TextStyle(color: Color(0xFFEBD9FB), fontSize: 14)),
              const SizedBox(height: 14),
              _wa('🇩🇪  WhatsApp Germania', '+49 1573 9037885', 'https://wa.me/4915739037885'),
              const SizedBox(height: 8),
              _wa('🇮🇹  WhatsApp Italia', '+39 351 881 8391', 'https://wa.me/393518818391'),
              const SizedBox(height: 10),
              Wrap(alignment: WrapAlignment.spaceBetween, children: [
                TextButton.icon(
                  onPressed: () => _open('mailto:info@lbswork.com'),
                  style: TextButton.styleFrom(foregroundColor: Colors.white),
                  icon: const Icon(Icons.mail_outline_rounded, size: 18),
                  label: const Text('info@lbswork.com'),
                ),
                TextButton.icon(
                  onPressed: () => _open('https://www.lbswork.com'),
                  style: TextButton.styleFrom(foregroundColor: kLilac),
                  icon: const Icon(Icons.language_rounded, size: 18),
                  label: const Text('lbswork.com'),
                ),
              ]),
            ]),
          ),
        ]),
      );

  Widget _wa(String label, String number, String url) => Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _open(url),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(children: [
              const IconBubble(Icons.chat_rounded, size: 38, bg: kWhatsApp, fg: Colors.white),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kMuted)),
                  Text(number, style: const TextStyle(fontFamily: 'PlusJakartaSans', fontWeight: FontWeight.w800, fontSize: 16, color: kInk)),
                ]),
              ),
              const Icon(Icons.chevron_right_rounded, color: kPurple),
            ]),
          ),
        ),
      );
}
