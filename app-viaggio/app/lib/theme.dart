import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'models/transit.dart';

const kPurple = Color(0xFF5E2D61);
const kDark = Color(0xFF30103D);
const kLilac = Color(0xFFDAB6FC);
const kGreen = Color(0xFF2FBF6B);
const kRed = Color(0xFFE5484D);
const kOrange = Color(0xFFF59E0B);

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: kPurple, primary: kPurple, secondary: kLilac);
  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    scaffoldBackgroundColor: const Color(0xFFF7F3F9),
    appBarTheme: const AppBarTheme(backgroundColor: kPurple, foregroundColor: Colors.white, centerTitle: false),
    cardTheme: CardThemeData(elevation: 0, color: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18))),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(minimumSize: const Size(64, 52), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
    ),
    inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(14))),
  );
}

final hm = DateFormat('HH:mm');
final dayFmt = DateFormat('EEE d MMM', 'it');

String fmtTime(DateTime? t) => t == null ? '--:--' : hm.format(t);
String fmtDur(Duration d) => d.inHours > 0 ? '${d.inHours} h ${d.inMinutes % 60} min' : '${d.inMinutes} min';

Color lineColor(Line? l) => switch (l?.product) {
      'bus' => const Color(0xFF8E3A8E),
      'tram' => const Color(0xFFC0392B),
      'subway' => const Color(0xFF1F5FBF),
      'suburban' => const Color(0xFF2E8B57),
      'regional' || 'regionalExpress' => const Color(0xFFB03030),
      'nationalExpress' || 'national' => const Color(0xFF404040),
      _ => kPurple,
    };

IconData lineIcon(Line? l) => switch (l?.product) {
      'bus' => Icons.directions_bus_rounded,
      'tram' => Icons.tram_rounded,
      'subway' => Icons.subway_rounded,
      'ferry' => Icons.directions_boat_rounded,
      _ => Icons.train_rounded,
    };

class LineChip extends StatelessWidget {
  final Line? line;
  final bool big;
  const LineChip(this.line, {super.key, this.big = false});
  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.symmetric(horizontal: big ? 12 : 8, vertical: big ? 6 : 3),
        decoration: BoxDecoration(color: lineColor(line), borderRadius: BorderRadius.circular(8)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(lineIcon(line), size: big ? 20 : 15, color: Colors.white),
          const SizedBox(width: 4),
          Text(line?.name ?? '', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: big ? 16 : 13)),
        ]),
      );
}

/// Orario con ritardo: "08:15" barrato + "08:22" in rosso.
class TimeText extends StatelessWidget {
  final DateTime? actual, planned;
  final double size;
  const TimeText(this.actual, this.planned, {super.key, this.size = 16});
  @override
  Widget build(BuildContext context) {
    final delay = (actual != null && planned != null) ? actual!.difference(planned!).inMinutes : 0;
    final base = TextStyle(fontSize: size, fontWeight: FontWeight.w800, color: kDark, fontFeatures: const [FontFeature.tabularFigures()]);
    if (delay.abs() < 1) return Text(fmtTime(actual ?? planned), style: base);
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Text(fmtTime(planned), style: base.copyWith(decoration: TextDecoration.lineThrough, color: Colors.black38, fontSize: size * .85)),
      const SizedBox(width: 6),
      Text(fmtTime(actual), style: base.copyWith(color: delay > 0 ? kRed : kGreen)),
    ]);
  }
}
