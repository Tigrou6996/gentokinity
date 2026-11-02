import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'screens/home_screen.dart';
import 'services/trip_store.dart';
import 'services/voice.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('it');
  await Future.wait([TripStore.instance.load(), VoiceService.instance.loadSettings()]);
  runApp(const ViaggioApp());
}

class ViaggioApp extends StatelessWidget {
  const ViaggioApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'LBS Viaggio',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        locale: const Locale('it'),
        supportedLocales: const [Locale('it'), Locale('de'), Locale('en')],
        localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
        home: const HomeScreen(),
      );
}
