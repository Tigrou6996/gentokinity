import 'transit.dart';

/// Dati letti dal biglietto (o inseriti a mano) per cercare il viaggio.
class TicketInfo {
  String? from, to; // nomi come scritti sul biglietto
  DateTime? date; // giorno del viaggio
  int? hour, minute; // ora di partenza, se presente
  String? operator; // es. "Deutsche Bahn", "FlixBus"
  String? filePath; // copia del biglietto (immagine o PDF) dentro l'app
  String? fileType; // image | pdf
  String? code; // contenuto del QR/codice a barre, se scansionato
  String rawText; // testo riconosciuto (per controllo)

  TicketInfo({this.from, this.to, this.date, this.hour, this.minute, this.operator, this.filePath, this.fileType, this.code, this.rawText = ''});

  DateTime? get departure => date == null ? null : DateTime(date!.year, date!.month, date!.day, hour ?? 0, minute ?? 0);

  Map<String, dynamic> toJson() => {
        'from': from,
        'to': to,
        'date': date?.toIso8601String(),
        'hour': hour,
        'minute': minute,
        'operator': operator,
        'filePath': filePath,
        'fileType': fileType,
        'code': code,
        'rawText': rawText,
      };

  factory TicketInfo.fromJson(Map<String, dynamic> j) => TicketInfo(
        from: j['from'] as String?,
        to: j['to'] as String?,
        date: j['date'] is String ? DateTime.tryParse(j['date'] as String) : null,
        hour: j['hour'] as int?,
        minute: j['minute'] as int?,
        operator: j['operator'] as String?,
        filePath: j['filePath'] as String?,
        fileType: j['fileType'] as String?,
        code: j['code'] as String?,
        rawText: (j['rawText'] ?? '') as String,
      );
}

/// Un viaggio salvato: biglietto + soluzione scelta (con fermate e percorso).
class SavedTrip {
  final String id;
  final TicketInfo ticket;
  Journey journey;
  final Place from, to;
  final DateTime createdAt;

  SavedTrip({required this.id, required this.ticket, required this.journey, required this.from, required this.to, required this.createdAt});

  String get title => '${from.name} → ${to.name}';

  Map<String, dynamic> toJson() => {
        'id': id,
        'ticket': ticket.toJson(),
        'journey': journey.raw,
        'from': from.toJson(),
        'to': to.toJson(),
        'createdAt': createdAt.toIso8601String(),
      };

  factory SavedTrip.fromJson(Map<String, dynamic> j) => SavedTrip(
        id: j['id'] as String,
        ticket: TicketInfo.fromJson(Map<String, dynamic>.from(j['ticket'] as Map)),
        journey: Journey.fromJson(Map<String, dynamic>.from(j['journey'] as Map)),
        from: Place.fromJson(Map<String, dynamic>.from(j['from'] as Map)),
        to: Place.fromJson(Map<String, dynamic>.from(j['to'] as Map)),
        createdAt: DateTime.parse(j['createdAt'] as String),
      );
}
