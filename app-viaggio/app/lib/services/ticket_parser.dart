import '../models/trip.dart';

/// Legge partenza, arrivo, data e ora dal testo di un biglietto (riconosciuto con OCR, estratto da un PDF o
/// letto da un QR). Funziona con i biglietti più comuni in Germania (Deutsche Bahn, FlixBus, aziende locali)
/// scritti in tedesco, italiano o inglese. Il risultato va sempre fatto confermare all'utente.
class TicketParser {
  /// [today] serve per indovinare l'anno quando il biglietto scrive solo "12.11.".
  static TicketInfo parse(String text, {DateTime? today}) {
    final now = today ?? DateTime.now();
    final t = text.replaceAll('\r', '').replaceAll(RegExp(r'[–—]'), '-').replaceAll(RegExp(r'\s*(→|->|=>|➔|➜|›|»)\s*'), ' → ');
    final lines = t.split('\n').map((l) => l.trim()).where((l) => l.isNotEmpty).toList();
    final info = TicketInfo(rawText: text);

    info.operator = _operator(t);
    info.date = _date(t, now);
    final time = _time(t);
    if (time != null) {
      info.hour = time.$1;
      info.minute = time.$2;
    }

    final (from, to, depTime) = _places(lines);
    info.from = from;
    info.to = to;
    if (depTime != null) {
      info.hour = depTime.$1;
      info.minute = depTime.$2;
    }
    return info;
  }

  static String? _operator(String t) {
    final l = t.toLowerCase();
    if (l.contains('flixbus') || l.contains('flixtrain')) return 'FlixBus';
    if (l.contains('deutschlandticket') || l.contains('deutschland-ticket')) return 'Deutschlandticket';
    if (l.contains('deutsche bahn') || l.contains('db fernverkehr') || l.contains('db regio') || l.contains('bahn.de')) return 'Deutsche Bahn';
    if (l.contains('blablacar')) return 'BlaBlaCar Bus';
    return null;
  }

  // ---------- date ----------
  static const _months = {
    'jan': 1, 'gen': 1, 'feb': 2, 'mär': 3, 'mar': 3, 'apr': 4, 'mai': 5, 'may': 5, 'mag': 5, 'jun': 6, 'giu': 6,
    'jul': 7, 'lug': 7, 'aug': 8, 'ago': 8, 'sep': 9, 'set': 9, 'okt': 10, 'oct': 10, 'ott': 10, 'nov': 11, 'dez': 12, 'dec': 12, 'dic': 12,
  };

  static DateTime? _date(String t, DateTime now) {
    final found = <DateTime>[];
    void add(int y, int m, int d) {
      if (y < 100) y += 2000;
      if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return;
      final dt = DateTime(y, m, d);
      if (dt.month == m) found.add(dt);
    }

    for (final m in RegExp(r'\b(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})\b').allMatches(t)) {
      add(int.parse(m[3]!), int.parse(m[2]!), int.parse(m[1]!));
    }
    for (final m in RegExp(r'\b(\d{4})-(\d{2})-(\d{2})\b').allMatches(t)) {
      add(int.parse(m[1]!), int.parse(m[2]!), int.parse(m[3]!));
    }
    for (final m in RegExp(r'\b(\d{1,2})\.?\s+([A-Za-zÄÖÜäöüé]{3,})\.?\s+(\d{4})\b').allMatches(t)) {
      final mon = _months[m[2]!.toLowerCase().substring(0, 3)];
      if (mon != null) add(int.parse(m[3]!), mon, int.parse(m[1]!));
    }
    if (found.isEmpty) {
      // "12.11." senza anno (tabella della DB): prossima occorrenza da oggi
      for (final m in RegExp(r'(?<![\d.])(\d{1,2})\.(\d{1,2})\.(?!\d)').allMatches(t)) {
        final d = int.parse(m[1]!), mo = int.parse(m[2]!);
        if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
        var dt = DateTime(now.year, mo, d);
        if (dt.isBefore(DateTime(now.year, now.month, now.day).subtract(const Duration(days: 60)))) dt = DateTime(now.year + 1, mo, d);
        found.add(dt);
      }
    }
    if (found.isEmpty) return null;
    // il primo giorno da ieri in poi (le date di acquisto sono di solito passate)
    final yesterday = DateTime(now.year, now.month, now.day).subtract(const Duration(days: 1));
    return found.firstWhere((d) => !d.isBefore(yesterday), orElse: () => found.first);
  }

  // ---------- time ----------
  static (int, int)? _time(String t) {
    final kw = RegExp(r'(?:\bab\b|abfahrt|abf\.?|departure|dep\.?|partenza|part\.)\s*:?\s*(?:um\s+|ore\s+|at\s+)?(\d{1,2})[:.](\d{2})\b', caseSensitive: false);
    final m = kw.firstMatch(t);
    if (m != null) return _hm(m[1]!, m[2]!);
    for (final x in RegExp(r'(?<![\d.:])(\d{1,2}):(\d{2})(?![\d:])').allMatches(t)) {
      final r = _hm(x[1]!, x[2]!);
      if (r != null) return r;
    }
    return null;
  }

  static (int, int)? _hm(String h, String m) {
    final hh = int.parse(h), mm = int.parse(m);
    return (hh < 24 && mm < 60) ? (hh, mm) : null;
  }

  // ---------- places ----------
  static final _fromKw = RegExp(r'^(?:von|start|abfahrt|abfahrtsort|partenza|da|from|departure|origin)(?:\s*:\s*|\s+|$)(.*)$', caseSensitive: false);
  static final _toKw = RegExp(r'^(?:nach|ziel|ankunft|ankunftsort|arrivo|destinazione|a|to|arrival|destination)(?:\s*:\s*|\s+|$)(.*)$', caseSensitive: false);

  static (String?, String?, (int, int)?) _places(List<String> lines) {
    // 1) tabella DB: "Kassel-Wilhelmshöhe 12.11. ab 08:15 7 ICE 1234" ... "Frankfurt(Main)Hbf 12.11. an 09:45 8"
    final tab = RegExp(r'^(.+?)\s+\d{1,2}\.\d{1,2}\.?\s+(ab|an)\s+(\d{1,2})[:.](\d{2})', caseSensitive: false);
    String? f, to;
    (int, int)? dep;
    for (final l in lines) {
      final m = tab.firstMatch(l);
      if (m == null) continue;
      if (m[2]!.toLowerCase() == 'ab' && f == null) {
        f = _clean(m[1]!);
        dep = _hm(m[3]!, m[4]!);
      } else if (m[2]!.toLowerCase() == 'an') {
        to = _clean(m[1]!);
      }
    }
    if (f != null && to != null) return (f, to, dep);

    // 2) "von X nach Y" / "da X a Y" / "from X to Y" / "X → Y"
    final pairs = [
      RegExp(r'\bvon\s+(.+?)\s+nach\s+(.+)$', caseSensitive: false),
      RegExp(r'\bfrom\s+(.+?)\s+to\s+(.+)$', caseSensitive: false),
      RegExp(r'^da\s+(.+?)\s+a\s+(.+)$', caseSensitive: false),
      RegExp(r'^(.+?)\s+→\s+(.+)$'),
      RegExp(r'^(.+?)\s+>\s+(.+)$'),
    ];
    for (final l in lines) {
      for (final re in pairs) {
        final m = re.firstMatch(l);
        if (m != null) {
          final a = _clean(m[1]!), b = _clean(m[2]!);
          if (_plausible(a) && _plausible(b)) return (a, b, null);
        }
      }
    }

    // 3) righe con parola chiave: "Von: Kassel" / "Partenza" (a capo) "Kassel"
    String? kwFrom, kwTo;
    for (var i = 0; i < lines.length; i++) {
      final mf = _fromKw.firstMatch(lines[i]), mt = _toKw.firstMatch(lines[i]);
      if (mf != null && kwFrom == null) {
        final v = _clean(mf[1]!);
        kwFrom = _plausible(v) ? v : (i + 1 < lines.length && _plausible(_clean(lines[i + 1])) ? _clean(lines[i + 1]) : null);
      } else if (mt != null && kwTo == null) {
        final v = _clean(mt[1]!);
        kwTo = _plausible(v) ? v : (i + 1 < lines.length && _plausible(_clean(lines[i + 1])) ? _clean(lines[i + 1]) : null);
      }
    }
    if (kwFrom != null && kwTo != null) return (kwFrom, kwTo, null);

    // 4) stile FlixBus: "08:15 Kassel (Wilhelmshöhe)" ... "12:30 München ZOB"
    final timed = RegExp(r'^(\d{1,2})[:.](\d{2})\s+([A-Za-zÄÖÜäöüß][^\d]{2,})$');
    final hits = lines.map(timed.firstMatch).whereType<RegExpMatch>().where((m) => _plausible(_clean(m[3]!))).toList();
    if (hits.length >= 2) return (_clean(hits.first[3]!), _clean(hits.last[3]!), _hm(hits.first[1]!, hits.first[2]!));

    return (kwFrom ?? f, kwTo ?? to, dep);
  }

  static String _clean(String s) {
    var r = s
        .replaceAll(RegExp(r'\b(gleis|bstg\.?|bahnsteig|binario|platform|track)\b.*$', caseSensitive: false), '')
        .replaceAll(RegExp(r'\b\d{1,2}[:.]\d{2}\b'), '')
        .replaceAll(RegExp(r'\b\d{1,2}[./]\d{1,2}[./]?(\d{2,4})?\b'), '')
        .replaceAll(RegExp(r'\s{2,}'), ' ')
        .trim();
    r = r.replaceAll(RegExp(r'^[\s,;:\-–]+|[\s,;:\-–]+$'), '');
    return r;
  }

  static bool _plausible(String s) => s.length >= 3 && s.length <= 60 && RegExp(r'[A-Za-zÄÖÜäöüß]{3,}').hasMatch(s);
}
