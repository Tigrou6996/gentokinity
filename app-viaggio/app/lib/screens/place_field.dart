import 'dart:async';
import 'package:flutter/material.dart';
import '../models/transit.dart';
import '../services/transit_api.dart';
import '../theme.dart';

/// Campo "Da" / "A": mostra la fermata scelta; toccandolo si apre la ricerca.
class PlaceField extends StatelessWidget {
  final String label;
  final Place? value;
  final String? hint; // testo letto dal biglietto
  final bool tentative; // scelta automatica da confermare
  final ValueChanged<Place> onChanged;
  const PlaceField({super.key, required this.label, required this.value, this.hint, this.tentative = false, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () async {
        final p = await showModalBottomSheet<Place>(
          context: context,
          isScrollControlled: true,
          useSafeArea: true,
          builder: (_) => PlaceSearchSheet(initial: value?.name ?? hint ?? ''),
        );
        if (p != null) onChanged(p);
      },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(label.startsWith('Da') ? Icons.trip_origin_rounded : Icons.place_rounded, color: kPurple),
          suffixIcon: tentative ? const Tooltip(message: 'Controlla che sia giusta', child: Icon(Icons.help_outline_rounded, color: kOrange)) : const Icon(Icons.search_rounded),
          helperText: tentative ? 'Trovata dal biglietto: controlla che sia giusta' : null,
        ),
        child: Text(value?.name ?? (hint?.isNotEmpty == true ? hint! : 'Scegli la fermata'),
            style: TextStyle(fontSize: 17, fontWeight: value != null ? FontWeight.w600 : FontWeight.w400, color: value != null ? kDark : Colors.black45)),
      ),
    );
  }
}

class PlaceSearchSheet extends StatefulWidget {
  final String initial;
  const PlaceSearchSheet({super.key, this.initial = ''});
  @override
  State<PlaceSearchSheet> createState() => _PlaceSearchSheetState();
}

class _PlaceSearchSheetState extends State<PlaceSearchSheet> {
  final _api = TransitApi();
  late final _ctl = TextEditingController(text: widget.initial);
  Timer? _deb;
  List<Place> _res = [];
  bool _loading = false;
  String? _err;

  @override
  void initState() {
    super.initState();
    if (widget.initial.length >= 2) _search(widget.initial);
  }

  @override
  void dispose() {
    _deb?.cancel();
    _ctl.dispose();
    super.dispose();
  }

  void _onChanged(String q) {
    _deb?.cancel();
    _deb = Timer(const Duration(milliseconds: 350), () => _search(q));
  }

  Future<void> _search(String q) async {
    setState(() {
      _loading = true;
      _err = null;
    });
    try {
      final r = await _api.searchPlaces(q);
      if (mounted && _ctl.text == q) setState(() => _res = r);
    } catch (e) {
      if (mounted) setState(() => _err = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * .8,
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _ctl,
              autofocus: true,
              onChanged: _onChanged,
              textInputAction: TextInputAction.search,
              onSubmitted: _search,
              decoration: InputDecoration(
                hintText: 'Fermata, stazione o indirizzo',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _loading ? const Padding(padding: EdgeInsets.all(14), child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))) : null,
              ),
            ),
          ),
          if (_err != null) Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Text(_err!, style: const TextStyle(color: kRed))),
          Expanded(
            child: ListView.separated(
              itemCount: _res.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (_, i) {
                final p = _res[i];
                return ListTile(
                  leading: Icon(p.isStop ? Icons.directions_bus_rounded : Icons.home_rounded, color: kPurple),
                  title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(p.isStop ? 'Fermata / stazione' : 'Indirizzo'),
                  onTap: () => Navigator.of(context).pop(p),
                );
              },
            ),
          ),
        ]),
      ),
    );
  }
}
