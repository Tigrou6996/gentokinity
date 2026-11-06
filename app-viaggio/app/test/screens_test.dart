import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:lbs_viaggio/models/trip.dart';
import 'package:lbs_viaggio/screens/home_screen.dart';
import 'package:lbs_viaggio/screens/login_screen.dart';
import 'package:lbs_viaggio/screens/trip_screen.dart';
import 'package:lbs_viaggio/services/demo.dart';
import 'package:lbs_viaggio/services/trip_store.dart';
import 'package:lbs_viaggio/theme.dart';
import 'guide_engine_test.dart' show sample;

// Controlla che le schermate principali si disegnino su un telefono piccolo senza errori di impaginazione.
void main() {
  setUpAll(() => initializeDateFormatting('it'));

  Widget app(Widget home) => MaterialApp(theme: buildTheme(), home: home);

  testWidgets('home vuota', (t) async {
    t.view.physicalSize = const Size(360 * 3, 690 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    TripStore.instance.trips.clear();
    await t.pumpWidget(app(const HomeScreen()));
    expect(find.text('Aggiungi il tuo biglietto'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('home con un viaggio', (t) async {
    t.view.physicalSize = const Size(360 * 3, 690 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final j = sample(DateTime.now().add(const Duration(hours: 3)));
    TripStore.instance.trips
      ..clear()
      ..add(SavedTrip(id: '1', ticket: TicketInfo(operator: 'Deutsche Bahn'), journey: j, from: j.legs.first.origin, to: j.legs.last.destination, createdAt: DateTime.now()));
    await t.pumpWidget(app(const HomeScreen()));
    expect(find.text('Wilhelmshöhe'), findsOneWidget);
    expect(find.text('Göttingen'), findsOneWidget);
    expect(find.text('Bus 42'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('viaggio di esempio: schema, coincidenze e fermate', (t) async {
    t.view.physicalSize = const Size(360 * 3, 690 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final d = Demo.trip();
    TripStore.instance.trips
      ..clear()
      ..add(d);
    await t.pumpWidget(app(TripScreen(tripId: d.id)));
    await t.pump();
    expect(find.textContaining('Anteprima: la mappa Google'), findsOneWidget);
    await t.tap(find.text('Coincidenze'));
    await t.pumpAndSettle();
    expect(find.textContaining('Cambio a Kassel Hauptbahnhof'), findsOneWidget);
    await t.ensureVisible(find.text('Fermate'));
    await t.pumpAndSettle();
    await t.tap(find.text('Fermate'));
    await t.pumpAndSettle();
    expect(find.text('Bebelplatz'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('accesso: senza Supabase si può entrare senza account', (t) async {
    t.view.physicalSize = const Size(360 * 3, 690 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(app(const LoginScreen()));
    expect(find.textContaining('non ancora collegato a Supabase'), findsOneWidget);
    expect(find.text('Continua senza account'), findsOneWidget);
    await t.tap(find.text('Registrati'));
    await t.pumpAndSettle();
    expect(find.text('Nome e cognome'), findsOneWidget);
    expect(t.takeException(), isNull);
  });
}
