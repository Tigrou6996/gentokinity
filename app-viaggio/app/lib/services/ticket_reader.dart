import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdfx/pdfx.dart';
import '../models/trip.dart';
import 'ticket_parser.dart';
import 'trip_store.dart';

/// Acquisisce il biglietto (foto, immagine, PDF o QR) e ne legge il testo sul telefono, senza inviarlo a nessuno.
class TicketReader {
  final _picker = ImagePicker();

  // nel browser non c'è il riconoscimento del testo (ML Kit è solo per telefono)
  static const webMsg = 'Nel browser il biglietto non si può leggere: inserisci partenza e arrivo a mano. Sul telefono la lettura è automatica.';

  Future<TicketInfo?> fromCamera() async {
    if (kIsWeb) throw StateError(webMsg);
    final x = await _picker.pickImage(source: ImageSource.camera, imageQuality: 92, maxWidth: 2400);
    return x == null ? null : _fromImage(x.path);
  }

  Future<TicketInfo?> fromGallery() async {
    if (kIsWeb) throw StateError(webMsg);
    final x = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 92, maxWidth: 2400);
    return x == null ? null : _fromImage(x.path);
  }

  Future<TicketInfo?> fromFile() async {
    if (kIsWeb) throw StateError(webMsg);
    final files = await FilePicker.pickFiles(type: FileType.custom, allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png']);
    if (files.isEmpty) return null;
    final f = files.first;
    var path = f.path;
    if (path == null) {
      // su alcuni dispositivi il file arriva solo come byte: lo salviamo in una cartella temporanea
      final tmp = await getTemporaryDirectory();
      path = '${tmp.path}/${f.name}';
      await File(path).writeAsBytes(await f.readAsBytes());
    }
    return (f.extension ?? '').toLowerCase() == 'pdf' ? _fromPdf(path) : _fromImage(path);
  }

  /// Contenuto di un QR / codice a barre. Molti QR contengono solo un codice: in quel caso
  /// il viaggio va completato a mano, ma il codice resta salvato con il biglietto.
  TicketInfo fromCode(String code) {
    final info = TicketParser.parse(code);
    info.code = code;
    return info;
  }

  Future<TicketInfo> _fromImage(String path) async {
    final kept = await TripStore.instance.keepTicketFile(path);
    final text = await _ocr(kept);
    final info = TicketParser.parse(text);
    info.filePath = kept;
    info.fileType = 'image';
    return info;
  }

  Future<TicketInfo> _fromPdf(String path) async {
    final kept = await TripStore.instance.keepTicketFile(path);
    final buf = StringBuffer();
    final doc = await PdfDocument.openFile(kept);
    final tmp = await getTemporaryDirectory();
    try {
      // le informazioni del viaggio sono quasi sempre nelle prime due pagine
      for (var n = 1; n <= doc.pagesCount && n <= 2; n++) {
        final page = await doc.getPage(n);
        try {
          final img = await page.render(width: page.width * 2.5, height: page.height * 2.5, format: PdfPageImageFormat.png, backgroundColor: '#FFFFFF');
          if (img == null) continue;
          final f = File('${tmp.path}/biglietto_p$n.png');
          await f.writeAsBytes(img.bytes);
          buf.writeln(await _ocr(f.path));
        } finally {
          await page.close();
        }
      }
    } finally {
      await doc.close();
    }
    final info = TicketParser.parse(buf.toString());
    info.filePath = kept;
    info.fileType = 'pdf';
    return info;
  }

  Future<String> _ocr(String imagePath) async {
    final rec = TextRecognizer(script: TextRecognitionScript.latin);
    try {
      final r = await rec.processImage(InputImage.fromFilePath(imagePath));
      // riga per riga, nell'ordine di lettura
      return r.blocks.expand((b) => b.lines).map((l) => l.text).join('\n');
    } finally {
      await rec.close();
    }
  }
}
