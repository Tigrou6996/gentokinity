import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'models/transit.dart';

const kPurple = Color(0xFF5E2D61);
const kDark = Color(0xFF30103D);
const kLilac = Color(0xFFDAB6FC);
const kGreen = Color(0xFF2FBF6B);
const kRed = Color(0xFFE5484D);
const kOrange = Color(0xFFF59E0B);
const kWhatsApp = Color(0xFF25D366);

const kBg = Color(0xFFF6F1F8);
const kInk = Color(0xFF30103D);
const kMuted = Color(0xFF7D6787);

/// Tema LBS: viola e lilla dell'agenzia, Plus Jakarta Sans per i titoli, Inter per i testi.
ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: kPurple, primary: kPurple, secondary: kLilac, surface: Colors.white);
  const head = 'PlusJakartaSans';
  final base = ThemeData(useMaterial3: true, fontFamily: 'Inter', colorScheme: scheme).textTheme;
  TextStyle? h(TextStyle? t, [FontWeight w = FontWeight.w800]) => t?.copyWith(fontFamily: head, fontWeight: w, color: kInk, letterSpacing: -.3);
  final text = base.copyWith(
    displaySmall: h(base.displaySmall),
    headlineLarge: h(base.headlineLarge),
    headlineMedium: h(base.headlineMedium),
    headlineSmall: h(base.headlineSmall),
    titleLarge: h(base.titleLarge),
    titleMedium: h(base.titleMedium, FontWeight.w700),
  ).apply(bodyColor: kInk, displayColor: kInk);
  final pill = RoundedRectangleBorder(borderRadius: BorderRadius.circular(999));
  return ThemeData(
    useMaterial3: true,
    fontFamily: 'Inter',
    colorScheme: scheme,
    textTheme: text,
    scaffoldBackgroundColor: kBg,
    appBarTheme: const AppBarTheme(
      backgroundColor: kPurple,
      foregroundColor: Colors.white,
      centerTitle: false,
      elevation: 0,
      titleTextStyle: TextStyle(fontFamily: head, fontWeight: FontWeight.w800, fontSize: 20, color: Colors.white),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: Colors.white,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22), side: const BorderSide(color: Color(0xFFEDE3F2))),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: kPurple,
        minimumSize: const Size(64, 54),
        shape: pill,
        textStyle: const TextStyle(fontFamily: head, fontWeight: FontWeight.w800, fontSize: 16),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(foregroundColor: kPurple, minimumSize: const Size(64, 50), shape: pill, side: const BorderSide(color: kPurple, width: 1.6)),
    ),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: kPurple, textStyle: const TextStyle(fontWeight: FontWeight.w700))),
    chipTheme: ChipThemeData(
      backgroundColor: const Color(0xFFF1E6FA),
      selectedColor: kLilac,
      labelStyle: const TextStyle(color: kInk, fontWeight: FontWeight.w600),
      side: BorderSide.none,
      shape: pill,
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Colors.white : const Color(0xFF9A83A6)),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? kGreen : const Color(0xFFE9DEF0)),
      trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
    ),
    tabBarTheme: TabBarThemeData(
      labelColor: kInk,
      unselectedLabelColor: Colors.white,
      indicatorSize: TabBarIndicatorSize.tab,
      dividerColor: Colors.transparent,
      indicator: BoxDecoration(color: kLilac, borderRadius: BorderRadius.circular(999)),
      labelStyle: const TextStyle(fontFamily: head, fontWeight: FontWeight.w800, fontSize: 13.5),
      unselectedLabelStyle: const TextStyle(fontFamily: head, fontWeight: FontWeight.w700, fontSize: 13.5),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE3D6EA))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE3D6EA))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: kPurple, width: 2)),
    ),
    snackBarTheme: SnackBarThemeData(backgroundColor: kInk, behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
  );
}

// ---------- elementi grafici LBS ----------

/// Viola LBS con il motivo delle icone dell'agenzia (furgone, pizza, cappello, farfalla, aereo).
class BrandPattern extends StatelessWidget {
  final BorderRadius? radius;
  const BrandPattern({super.key, this.radius});
  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          borderRadius: radius,
          gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF6E3874), kPurple, Color(0xFF3F1647)]),
          image: const DecorationImage(image: AssetImage('assets/images/pattern.png'), repeat: ImageRepeat.repeat, scale: 2.2),
        ),
      );
}

class LbsLogo extends StatelessWidget {
  final double size;
  const LbsLogo({super.key, this.size = 40});
  @override
  Widget build(BuildContext context) => Image.asset('assets/images/logo.png', width: size, height: size);
}

/// Barra in alto con il viola e il motivo LBS.
AppBar lbsBar({required Widget title, List<Widget>? actions, PreferredSizeWidget? bottom}) =>
    AppBar(title: title, actions: actions, bottom: bottom, flexibleSpace: const BrandPattern());

/// Titoletto di sezione in maiuscolo spaziato, come nei video LBS.
class SectionLabel extends StatelessWidget {
  final String text;
  const SectionLabel(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 18, 4, 10),
        child: Text(text.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1.8, fontSize: 12, color: kPurple)),
      );
}

/// Cerchio lilla con icona (stile delle icone LBS).
class IconBubble extends StatelessWidget {
  final IconData icon;
  final double size;
  final Color bg, fg;
  const IconBubble(this.icon, {super.key, this.size = 52, this.bg = kLilac, this.fg = kInk});
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
        child: Icon(icon, color: fg, size: size * .5),
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
    // in ritardo: orario previsto barrato sopra, orario reale sotto (stretto, entra anche nelle colonne piccole)
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(fmtTime(planned), style: base.copyWith(decoration: TextDecoration.lineThrough, color: Colors.black38, fontSize: size * .72, height: 1.1)),
      Text(fmtTime(actual), style: base.copyWith(color: delay > 0 ? kRed : kGreen, height: 1.1)),
    ]);
  }
}
