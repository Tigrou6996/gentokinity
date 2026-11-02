import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../models/transit.dart';
import '../models/trip.dart';
import '../services/ticket_reader.dart';
import '../services/transit_api.dart';
import '../theme.dart';
import 'journey_pick_screen.dart';
import 'place_field.dart';

/// Passo 1: da dove prendere il biglietto. Passo 2: conferma di partenza, arrivo, data e ora.
class AddTicketScreen extends StatefulWidget {
  const AddTicketScreen({super.key});
  @override
  State<AddTicketScreen> createState() => _AddTicketScreenState();
}

class _AddTicketScreenState extends State<AddTicketScreen> {
  final _reader = TicketReader();
  final _api = TransitApi();
  TicketInfo? _info;
  Place? _from, _to;
  bool _fromGuess = false, _toGuess = false;
  DateTime _date = DateTime.now();
  TimeOfDay _time = TimeOfDay.now();
  bool _busy = false;
  String? _msg;

  Future<void> _read(Future<TicketInfo?> Function() src) async {
    setState(() {
      _busy = true;
      _msg = null;
    });
    try {
      final info = await src();
      if (info == null) return;
      await _apply(info);
    } catch (e) {
      await _apply(TicketInfo());
      setState(() => _msg = e is StateError ? e.message : 'Non sono riuscito a leggere il biglietto ($e). Puoi inserire i dati a mano.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _apply(TicketInfo info) async {
    setState(() {
      _info = info;
      if (info.date != null) _date = info.date!;
      if (info.hour != null) _time = TimeOfDay(hour: info.hour!, minute: info.minute ?? 0);
      final found = [if (info.from != null) 'partenza', if (info.to != null) 'arrivo', if (info.date != null) 'data', if (info.hour != null) 'ora'];
      _msg = info.rawText.isEmpty && info.code == null
          ? null
          : found.isEmpty
              ? 'Non ho trovato i dati del viaggio sul biglietto: inseriscili qui sotto. Il biglietto resta salvato.'
              : 'Dal biglietto ho letto: ${found.join(', ')}. Controlla e correggi se serve.';
    });
    // prova a trovare subito le fermate scritte sul biglietto
    Future<Place?> guess(String? name) async {
      if (name == null || name.trim().length < 3) return null;
      try {
        final r = await _api.searchPlaces(name, results: 3);
        return r.isEmpty ? null : r.first;
      } catch (_) {
        return null;
      }
    }

    final res = await Future.wait([guess(info.from), guess(info.to)]);
    if (!mounted) return;
    setState(() {
      if (res[0] != null) {
        _from = res[0];
        _fromGuess = true;
      }
      if (res[1] != null) {
        _to = res[1];
        _toGuess = true;
      }
    });
  }

  Future<void> _scan() async {
    final code = await Navigator.of(context).push<String>(MaterialPageRoute(builder: (_) => const _ScanScreen()));
    if (code != null) await _read(() async => _reader.fromCode(code));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: lbsBar(title: Text(_info == null ? 'Aggiungi biglietto' : 'Il tuo viaggio')),
      body: AbsorbPointer(
        absorbing: _busy,
        child: Stack(children: [
          _info == null ? _sources() : _form(),
          if (_busy)
            const ColoredBox(
              color: Color(0x88FFFFFF),
              child: Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Sto leggendo il biglietto…', style: TextStyle(fontWeight: FontWeight.w600)),
                ]),
              ),
            ),
        ]),
      ),
    );
  }

  Widget _sources() {
    Widget tile(IconData ic, String t, String s, VoidCallback onTap) => Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
            leading: CircleAvatar(radius: 26, backgroundColor: kLilac, child: Icon(ic, color: kDark, size: 28)),
            title: Text(t, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
            subtitle: Text(s),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: onTap,
          ),
        );
    return ListView(padding: const EdgeInsets.all(16), children: [
      const Padding(
        padding: EdgeInsets.fromLTRB(4, 4, 4, 18),
        child: Text('Il biglietto viene letto sul telefono: partenza, arrivo, data e ora. Poi controlli tu che sia tutto giusto.', style: TextStyle(fontSize: 15, color: Colors.black54)),
      ),
      tile(Icons.photo_camera_rounded, 'Fotografa il biglietto', 'Biglietto di carta o sullo schermo di un altro telefono', () => _read(_reader.fromCamera)),
      tile(Icons.picture_as_pdf_rounded, 'Carica il PDF', 'Il biglietto ricevuto per email (DB, FlixBus, …)', () => _read(_reader.fromFile)),
      tile(Icons.photo_library_rounded, 'Scegli una foto', 'Uno screenshot o una foto già salvata', () => _read(_reader.fromGallery)),
      tile(Icons.qr_code_scanner_rounded, 'Scansiona il codice QR', 'Salva il codice del biglietto', _scan),
      const SizedBox(height: 8),
      TextButton.icon(onPressed: () => _apply(TicketInfo()), icon: const Icon(Icons.edit_rounded), label: const Text('Inserisci il viaggio a mano')),
    ]);
  }

  Widget _form() {
    final info = _info!;
    return ListView(padding: const EdgeInsets.all(16), children: [
      if (_msg != null)
        Card(
          color: const Color(0xFFF1E6FA),
          child: Padding(padding: const EdgeInsets.all(14), child: Row(children: [const Icon(Icons.info_outline_rounded, color: kPurple), const SizedBox(width: 12), Expanded(child: Text(_msg!))])),
        ),
      if (info.operator != null) Padding(padding: const EdgeInsets.only(top: 8), child: Chip(avatar: const Icon(Icons.confirmation_number_rounded, size: 18), label: Text(info.operator!))),
      const SizedBox(height: 12),
      PlaceField(label: 'Da', value: _from, hint: info.from, tentative: _fromGuess, onChanged: (p) => setState(() => (_from = p, _fromGuess = false))),
      const SizedBox(height: 14),
      PlaceField(label: 'A', value: _to, hint: info.to, tentative: _toGuess, onChanged: (p) => setState(() => (_to = p, _toGuess = false))),
      const SizedBox(height: 14),
      Row(children: [
        Expanded(
          child: _pick(Icons.calendar_today_rounded, 'Giorno', dayFmt.format(_date), () async {
            final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime.now().subtract(const Duration(days: 1)), lastDate: DateTime.now().add(const Duration(days: 365)));
            if (d != null) setState(() => _date = d);
          }),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _pick(Icons.schedule_rounded, 'Partenza dalle', _time.format(context), () async {
            final t = await showTimePicker(context: context, initialTime: _time);
            if (t != null) setState(() => _time = t);
          }),
        ),
      ]),
      const SizedBox(height: 24),
      FilledButton.icon(
        onPressed: _from != null && _to != null ? _search : null,
        icon: const Icon(Icons.search_rounded),
        label: const Text('Trova il percorso', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
      ),
      if (info.rawText.trim().isNotEmpty || info.code != null)
        ExpansionTile(
          title: const Text('Testo letto dal biglietto'),
          children: [Padding(padding: const EdgeInsets.all(12), child: SelectableText(info.code ?? info.rawText, style: const TextStyle(fontSize: 13, color: Colors.black54)))],
        ),
    ]);
  }

  Widget _pick(IconData ic, String label, String value, VoidCallback onTap) => InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: InputDecorator(
          decoration: InputDecoration(labelText: label, prefixIcon: Icon(ic, color: kPurple)),
          child: Text(value, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
        ),
      );

  void _search() {
    final dep = DateTime(_date.year, _date.month, _date.day, _time.hour, _time.minute);
    final info = _info!
      ..date = DateTime(_date.year, _date.month, _date.day)
      ..hour = _time.hour
      ..minute = _time.minute;
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => JourneyPickScreen(from: _from!, to: _to!, departure: dep, ticket: info)));
  }
}

class _ScanScreen extends StatefulWidget {
  const _ScanScreen();
  @override
  State<_ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<_ScanScreen> {
  bool _done = false;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: lbsBar(title: const Text('Inquadra il codice')),
        body: Stack(children: [
          MobileScanner(onDetect: (c) {
            final v = c.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
            if (v == null || _done) return;
            _done = true;
            Navigator.of(context).pop(v);
          }),
          const Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text('Tieni fermo il telefono sopra il QR o il codice del biglietto', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16, shadows: [Shadow(blurRadius: 8)])),
            ),
          ),
        ]),
      );
}
