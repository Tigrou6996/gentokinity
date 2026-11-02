import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:lbs_viaggio/models/trip.dart';
import 'package:lbs_viaggio/screens/home_screen.dart';
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
}
