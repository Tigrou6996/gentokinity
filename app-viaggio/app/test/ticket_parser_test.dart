import 'package:flutter_test/flutter_test.dart';
import 'package:lbs_viaggio/services/ticket_parser.dart';

void main() {
  final today = DateTime(2026, 11, 2);

  test('biglietto Deutsche Bahn (tabella Halt / Datum / Zeit)', () {
    const text = '''
DB Fernverkehr AG
Ihre Fahrkarte
Fahrtantritt am 12.11.2026
Halt Datum Zeit Gleis Produkte
Kassel-Wilhelmshöhe 12.11. ab 08:15 7 ICE 1234
Frankfurt(Main)Hbf 12.11. an 09:45 8
''';
    final t = TicketParser.parse(text, today: today);
    expect(t.operator, 'Deutsche Bahn');
    expect(t.from, 'Kassel-Wilhelmshöhe');
    expect(t.to, 'Frankfurt(Main)Hbf');
    expect(t.date, DateTime(2026, 11, 12));
    expect((t.hour, t.minute), (8, 15));
  });

  test('FlixBus con orari e città su righe separate', () {
    const text = '''
FlixBus
Buchungsnummer 3012345678
Abfahrt Mi., 18. Nov 2026
06:40 Catania
21:10 München ZOB
''';
    final t = TicketParser.parse(text, today: today);
    expect(t.operator, 'FlixBus');
    expect(t.from, 'Catania');
    expect(t.to, 'München ZOB');
    expect(t.date, DateTime(2026, 11, 18));
    expect((t.hour, t.minute), (6, 40));
  });

  test('"von ... nach ..." in tedesco', () {
    final t = TicketParser.parse('Einzelfahrt von Kassel Hbf nach Göttingen\nGültig am 03.12.2026 ab 14:05', today: today);
    expect(t.from, 'Kassel Hbf');
    expect(t.to, 'Göttingen');
    expect(t.date, DateTime(2026, 12, 3));
    expect((t.hour, t.minute), (14, 5));
  });

  test('biglietto in italiano con freccia', () {
    final t = TicketParser.parse('Biglietto\nNapoli Centrale → Milano Centrale\nData 05/01/2027 Partenza 07:30', today: today);
    expect(t.from, 'Napoli Centrale');
    expect(t.to, 'Milano Centrale');
    expect(t.date, DateTime(2027, 1, 5));
    expect((t.hour, t.minute), (7, 30));
  });

  test('parole chiave su righe diverse (Partenza / Arrivo)', () {
    final t = TicketParser.parse('Partenza\nHamburg ZOB\nArrivo\nBerlin Südkreuz\n2026-11-20 10:15', today: today);
    expect(t.from, 'Hamburg ZOB');
    expect(t.to, 'Berlin Südkreuz');
    expect(t.date, DateTime(2026, 11, 20));
  });

  test('data senza anno: sceglie il prossimo anno se già passata', () {
    final t = TicketParser.parse('Leipzig Hbf 05.01. ab 07:02 3 RE 4\nHalle(Saale)Hbf 05.01. an 07:40 6', today: today);
    expect(t.date, DateTime(2027, 1, 5));
    expect(t.from, 'Leipzig Hbf');
    expect(t.to, 'Halle(Saale)Hbf');
  });

  test('testo senza dati del viaggio', () {
    final t = TicketParser.parse('QR123456789ABC', today: today);
    expect(t.from, isNull);
    expect(t.to, isNull);
    expect(t.date, isNull);
  });
}
